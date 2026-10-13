/**
 * The mail system: AI characters writing to the player.
 *
 * Design constraints, in order of importance:
 *
 * 1. **Never flood.** The per-year budget, the per-NPC cooldown and the one
 *    decision per year all live in the pure `mailbox` module; this class only
 *    obeys them. Requests are queued and run one at a time, so a burst of
 *    writers can never become a burst of HTTP calls.
 * 2. **Never block a turn.** Generation is fire-and-forget: the yearly tick
 *    returns immediately, and letters appear when they arrive (a toast, and the
 *    inbox badge). A dead network costs nothing.
 * 3. **Never interrupt without cause.** Only a letter that carries a decision
 *    may pop a modal, and only one of those exists at a time.
 *
 * It reaches the rest of the game through the event bus rather than the
 * container, because injecting `CareerSystem` here would close a cycle through
 * `RelationshipSystem → WorldManager → CareerSystem`.
 */

import { inject } from "../../Container.js";
import ConfigStore from "../../core/store/ConfigStore.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import RandomService from "../../core/random/RandomService.js";
import NpcRegistry from "../relationships/NpcRegistry.js";
import RelationshipSystem from "../relationships/RelationshipSystem.js";
import WorldManager from "../../worlds/WorldManager.js";
import Player from "../Player.js";
import { deepseekChat } from "../../core/ai/deepseek.js";
import { playerDossier } from "../playerDossier.js";
import { buildPersona, type Persona } from "./persona.js";
import {
  letterMessages,
  wantsDecision,
  type LetterContext,
  type LetterOccasion,
} from "./correspondence.js";
import {
  parseLetter,
  parseOptionalLetter,
  MAX_THREAD_DEPTH,
  type Letter,
} from "./letter.js";
import {
  addLetter,
  answerLetter,
  budgetFor,
  canWrite,
  chooseWriters,
  emptyMailbox,
  markRead,
  noteReply,
  noteSent,
  openDecisions,
  remainingThisYear,
  repliesRemaining,
  type Mailbox,
  type MailFrequency,
} from "./mailbox.js";
import MailStore from "./MailStore.js";
import { digestJournal, type JournalDigest } from "./journal.js";
import { translate } from "../../core/language/translator.js";

/** Names the model is told to write in, so a letter is never in the wrong tongue. */
const LANGUAGE_NAMES: Record<string, string> = {
  zh_CN: "Chinese (Simplified)",
  en_US: "English",
  ja_JP: "Japanese",
  ru_RU: "Russian",
};

/** Letters kept in flight; one request at a time is the whole rate limiter. */
const MAX_QUEUE = 4;

type Listener = () => void;

export default class MailService {
  private config: ConfigStore;
  private eventBus: TypedEventBus;
  private random: RandomService;
  private npcs: NpcRegistry;
  private relationships: RelationshipSystem;
  private worlds: WorldManager;
  private store: MailStore;

  private box: Mailbox = emptyMailbox();
  private listeners = new Set<Listener>();
  private version = 0;

  private queue: Array<() => Promise<void>> = [];
  private running = false;
  private seq = 0;
  /** Decision letters the player waved away; session-scoped on purpose. */
  private deferred = new Set<string>();

  constructor() {
    this.config = inject(ConfigStore);
    this.eventBus = inject(TypedEventBus);
    this.random = inject(RandomService);
    this.npcs = inject(NpcRegistry);
    this.relationships = inject(RelationshipSystem);
    this.worlds = inject(WorldManager);
    this.store = inject(MailStore);

    // A new job is the clearest reason an NPC has to write: the boss introduces
    // themselves and hands over the first task.
    this.eventBus.on("career:joined", () => {
      this.queueCareerLetter("newJob");
    });
    this.eventBus.on("career:promoted", () => {
      this.queueCareerLetter("promotion");
    });
    this.eventBus.on("career:resigned", () => {
      this.queueCareerLetter("resignation");
    });
    this.eventBus.on("career:fired", () => {
      this.queueCareerLetter("fired");
    });

    // A new life starts with an empty box. Keyed off the *root* world so that
    // moving between stages of one life keeps the correspondence going — but
    // only when the life is genuinely new. `restoreWorld` re-enters a saved
    // root world and emits the same event, and resetting there would discard
    // the letters the save had only just handed back.
    this.eventBus.on("level:started", ({ levelId, resumed }) => {
      if (resumed) return;
      try {
        if (this.worlds.getRootWorldIds().includes(levelId)) this.reset();
      } catch {
        /* world not ready — the box is empty anyway */
      }
    });
  }

  // ── reactivity (useSyncExternalStore) ──────────────────────────
  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): number => this.version;

  /**
   * Every mutation lands here, so this is the one place that has to know the
   * box changed and now belongs on disk.
   *
   * Persisting from here instead of from the auto-save is the whole point of
   * the split: letters change a handful of times a year, while the auto-save
   * fires on every player action. The write is synchronous, and the payload is
   * bounded by construction (see `MAIL_LETTERS_MAX_BYTES`), so it is far too
   * small to be felt.
   */
  private notify(): void {
    this.bump();
    this.store.write(this.box);
  }

  /** Tell the UI the box changed, without touching the disk. */
  private bump(): void {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }

  // ── the box ────────────────────────────────────────────────────
  public getBox(): Mailbox {
    return this.box;
  }

  public read(letterId: string): void {
    const next = markRead(this.box, letterId);
    if (next === this.box) return;
    this.box = next;
    this.notify();
  }

  /**
   * File a letter whose text is already written, without asking the model.
   *
   * Used when the words arrive in the same breath as something else — an
   * invented character's opening line comes with the character, and paying a
   * second request to have them say hello again would be silly.
   */
  public fileLetter(
    player: Player,
    npcId: string,
    subject: string,
    body: string,
  ): void {
    if (!this.npcs.get(npcId) || !body.trim()) return;
    const letter: Letter = {
      id: `mail-${Math.floor(player.age)}-${npcId}-${++this.seq}`,
      npcId,
      year: Math.floor(player.age),
      subject,
      body,
      choices: [],
      status: "unread",
      depth: 0,
    };
    this.box = addLetter(this.box, letter);
    this.notify();
    this.eventBus.emit("mail:arrived", { npcId, demandsAnswer: false });
    this.eventBus.emit("toast", { textKey: "mail.toast.new", kind: "info" });
  }

  /**
   * The one decision that should interrupt the player, if any.
   *
   * A decision the player has waved away is not offered again — otherwise
   * dismissing the popup would bring it straight back, which is exactly the
   * behaviour this system exists to avoid. It is still sitting in the inbox.
   */
  public decision(): Letter | null {
    const open = openDecisions(this.box).filter((l) => !this.deferred.has(l.id));
    return open.length > 0 ? open[open.length - 1] : null;
  }

  /** "Not now" — hide the popup, keep the letter waiting in the inbox. */
  public defer(letterId: string): void {
    this.deferred.add(letterId);
    this.notify();
  }

  /**
   * Answer a letter. A letter with choices only closes once one was picked —
   * prose alone does not settle a question the NPC asked.
   */
  public answer(
    player: Player,
    letterId: string,
    reply: string | undefined,
    choiceId: string | undefined,
  ): boolean {
    const letter = this.box.letters.find((l) => l.id === letterId);
    if (!letter || letter.status === "answered") return false;
    if (letter.choices.length > 0 && !choiceId) return false;

    if (choiceId) {
      const choice = letter.choices.find((c) => c.id === choiceId);
      if (choice) player.adjustRelationship(letter.npcId, choice.affinity);
    }
    this.box = answerLetter(this.box, letterId, reply, choiceId);
    this.deferred.delete(letterId);
    player.notify();
    this.notify();

    // Answering is not necessarily the end of it: the character may write back.
    // Whether they do is the model's call — the prompt offers them silence —
    // and the caps below decide whether they are even asked.
    this.queueReply(player, letter, reply, choiceId);
    return true;
  }

  /**
   * Give the character a chance to answer what the player just wrote.
   *
   * Bounded by `MAX_THREAD_DEPTH` (one write-back per thread, so a conversation
   * cannot loop) and by the yearly write-back budget (so clearing a backlog of
   * old letters does not fire a burst of requests). These are *not* the yearly
   * initiation budget: answering a letter is not the character starting a new
   * subject, and charging it to the same pot would mean a reply could silence
   * the whole cast for the year.
   */
  private queueReply(
    player: Player,
    letter: Letter,
    reply: string | undefined,
    choiceId: string | undefined,
  ): void {
    if (letter.depth >= MAX_THREAD_DEPTH) return;
    if (!this.config.getDeepseekApiKey()) return;
    if (this.config.getMailFrequency() === "off") return;
    if (!this.npcs.get(letter.npcId)) return;

    const year = Math.floor(player.age);
    const chosenLabel = letter.choices.find((c) => c.id === choiceId)?.label;

    this.enqueue(() =>
      this.write("reply", letter.npcId, year, false, player, {
        playerReply: reply,
        chosenLabel,
        mayStaySilent: true,
        depth: letter.depth + 1,
      }),
    );
  }

  // ── generation ─────────────────────────────────────────────────
  /** The yearly pass. Returns at once; letters arrive asynchronously. */
  public tickYear(player: Player): void {
    const apiKey = this.config.getDeepseekApiKey();
    const frequency = this.config.getMailFrequency() as MailFrequency;
    if (!apiKey || frequency === "off") return;

    const budget = budgetFor(frequency);
    const year = Math.floor(player.age);
    if (remainingThisYear(this.box, year, budget) <= 0) return;

    const known = this.relationships.knownNpcIds(player);
    if (known.length === 0) return;

    const candidates = known
      .map((npcId) => {
        const npc = this.npcs.get(npcId);
        if (!npc) return null;
        const persona = buildPersona({
          npcId,
          nameKey: npc.labelKey,
          roleKey: npc.roleKey,
          traits: npc.traits(),
        });
        return { npcId, affinity: player.getRelationship(npcId), decisive: persona.decisive };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const writers = chooseWriters(
      candidates,
      this.box,
      year,
      budget,
      this.random.next.bind(this.random),
    );

    // Only one letter a year may carry a question, no matter how decisive the
    // cast is — that is the promise that the game never queues up modals.
    let decisionUsed = this.box.lastDecisionYear === year;

    for (const npcId of writers) {
      const persona = this.personaFor(npcId);
      if (!persona) continue;
      const allowDecision =
        !decisionUsed && wantsDecision(persona, this.random.next());
      if (allowDecision) decisionUsed = true;
      this.enqueue(() => this.write("yearly", npcId, year, allowDecision, player));
    }
  }

  /** Queue the letter an employment event justifies (the boss). */
  private queueCareerLetter(occasion: LetterOccasion): void {
    const apiKey = this.config.getDeepseekApiKey();
    if (!apiKey || this.config.getMailFrequency() === "off") return;
    const player = this.currentPlayer();
    if (!player) return;

    const bossId = this.pickBoss();
    if (!bossId) return;
    const year = Math.floor(player.age);
    // Deliberately outside the per-year budget: this is a story beat the player
    // caused, not the yearly drip. The cooldown still applies (re-checked in
    // `write`), so a boss cannot write twice in a row.
    this.enqueue(() => this.write(occasion, bossId, year, false, player));
  }

  private currentPlayer(): Player | null {
    try {
      return this.worlds.getPlayer() ?? null;
    } catch {
      // No life in progress (main menu, a torn-down world) — nothing to write to.
      return null;
    }
  }

  /** The NPC who would be the player's superior: the work-role one first. */
  private pickBoss(): string | null {
    const all = this.npcs.getAll();
    const work = all.filter((n) => n.roleKey === "npc.role.work");
    const pool = work.length > 0 ? work : all.filter((n) => n.id === "npc_boss");
    if (pool.length === 0) return null;
    return pool[this.random.int(pool.length)].id;
  }

  private personaFor(npcId: string): Persona | null {
    const npc = this.npcs.get(npcId);
    if (!npc) return null;
    return buildPersona({
      npcId,
      nameKey: npc.labelKey,
      roleKey: npc.roleKey,
      traits: npc.traits(),
    });
  }

  /** One queued job: build the prompt, ask, and file the answer. */
  private async write(
    occasion: LetterOccasion,
    npcId: string,
    year: number,
    allowDecision: boolean,
    player: Player,
    extra: {
      playerReply?: string;
      chosenLabel?: string;
      mayStaySilent?: boolean;
      depth?: number;
    } = {},
  ): Promise<void> {
    const persona = this.personaFor(npcId);
    if (!persona) return;

    const isReply = occasion === "reply";
    // Checked here rather than at the call site so the queue's serial nature
    // makes it race-free: two letters answered in the same tick cannot both
    // squeeze past the yearly write-back cap.
    if (isReply && repliesRemaining(this.box, year) <= 0) return;
    // A story beat (joined / promoted / walked out) is outside the yearly
    // budget because the player caused it, but it still obeys the writer's own
    // cooldown — otherwise a good year would mean three letters from the boss.
    // A reply is exempt: answering is not striking up a new subject.
    if (!isReply && occasion !== "yearly" && !canWrite(this.box, npcId, year)) {
      return;
    }

    const journal = this.journalDigest();
    const ctx: LetterContext = {
      year,
      recent: journal.own,
      around: journal.around,
      situation: this.situationLines(npcId),
      player: playerDossier(player),
      occasion,
      affinity: player.getRelationship(npcId),
      allowDecision,
      language: LANGUAGE_NAMES[this.config.getLanguage()] ?? "English",
      playerReply: extra.playerReply,
      chosenLabel: extra.chosenLabel,
      mayStaySilent: extra.mayStaySilent,
    };

    const result = await deepseekChat(
      this.config.getDeepseekApiKey(),
      letterMessages(persona, ctx),
      // The persona's temperature is what makes a volatile character read
      // differently from a rigid one; it is not decoration.
      { temperature: persona.temperature, maxTokens: 500, timeoutMs: 40_000 },
    );
    if (!result.ok) {
      // A failed letter is simply not sent — no toast, no retry storm. The
      // player never learns the model was down.
      console.warn(`[mail] ${npcId} 的来信生成失败: ${result.kind} ${result.error}`);
      return;
    }

    const npc = this.npcs.get(npcId);
    const nameKey = npc?.labelKey ?? npcId;
    // A reply may come back empty: the character chose to let the matter rest,
    // which is a legitimate outcome and not a letter at all.
    const parsed = extra.mayStaySilent
      ? parseOptionalLetter(result.text, nameKey)
      : parseLetter(result.text, nameKey);
    if (!parsed) return;

    const letter: Letter = {
      id: `mail-${year}-${npcId}-${++this.seq}`,
      npcId,
      year,
      subject: parsed.subject,
      body: parsed.body,
      choices: parsed.choices,
      status: "unread",
      depth: extra.depth ?? 0,
    };

    this.box = addLetter(this.box, letter);
    if (isReply) {
      this.box = noteReply(this.box, year);
    } else {
      const budget = budgetFor(this.config.getMailFrequency() as MailFrequency);
      this.box = noteSent(this.box, npcId, year, budget);
      if (letter.choices.length > 0) this.box.lastDecisionYear = year;
    }
    this.notify();

    this.eventBus.emit("mail:arrived", {
      npcId,
      demandsAnswer: letter.choices.length > 0,
    });
    this.eventBus.emit("toast", {
      textKey: letter.choices.length > 0 ? "mail.toast.decision" : "mail.toast.new",
      kind: "info",
    });
  }

  /**
   * This year's journal, as plain translated lines the model can read, split by
   * whose life each one happened in.
   */
  private journalDigest(): JournalDigest {
    try {
      const store = this.worlds.getCurrentLogStore();
      return digestJournal(store?.getSnapshot() ?? [], translate);
    } catch {
      return { own: [], around: [] };
    }
  }

  /**
   * What the writer's own life looks like this year, in language-free facts.
   *
   * No translation happens here on purpose: the model is told which tongue to
   * write in, and it is the one turning these numbers into the character's own
   * words. Translating them first would only bake the UI's phrasing into a
   * letter that is supposed to sound like a person.
   */
  private situationLines(npcId: string): string[] {
    const detail = this.relationships.getDetail(npcId);
    if (!detail) return [];
    const lines: string[] = [];
    if (detail.age !== undefined) lines.push(`You are ${detail.age} years old.`);
    if (detail.health !== undefined) lines.push(`Your health is ${detail.health}/100.`);
    if (detail.wealth !== undefined) lines.push(`Your wealth is ${detail.wealth}/100.`);
    if (detail.careerTier !== undefined) {
      lines.push(`Your career tier is ${detail.careerTier} of 4.`);
    }
    lines.push(`Your feelings about the player stand at ${detail.affinity}/100.`);
    return lines;
  }

  // ── queue ──────────────────────────────────────────────────────
  private enqueue(task: () => Promise<void>): void {
    if (this.queue.length >= MAX_QUEUE) return;
    this.queue.push(task);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const task = this.queue.shift();
        if (!task) break;
        try {
          await task();
        } catch (err) {
          console.warn("[mail] 任务失败:", err);
        }
      }
    } finally {
      this.running = false;
    }
  }

  // ── persistence ────────────────────────────────────────────────
  /**
   * Adopt a mailbox that arrived inside a save blob.
   *
   * Only saves written before the split carry one — the letters have their own
   * file now — so this is a one-way migration: take what the save holds, write
   * it straight to the mailbox file, and let the save's copy fall out of use.
   */
  public restore(snap: { box?: Mailbox } | undefined): void {
    if (!snap?.box) {
      this.loadFromStore();
      return;
    }
    this.box = { ...emptyMailbox(), ...snap.box };
    this.notify();
  }

  /**
   * Load this life's correspondence from its own file. Runs once per load,
   * after the save has put the player back in their world.
   */
  public loadFromStore(): void {
    this.box = this.store.read() ?? emptyMailbox();
    // The disk already holds this, so bump the version for the UI but do not
    // write back what was just read — and never overwrite a file that failed
    // to parse, since that copy is the only one the letters have left.
    this.bump();
  }

  /** A new life starts with an empty box. */
  public reset(): void {
    this.box = emptyMailbox();
    this.notify();
  }
}
