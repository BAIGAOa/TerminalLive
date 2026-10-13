import { inject } from "../../Container.js";
import Player from "../Player.js";
import ConfigStore from "../../core/store/ConfigStore.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import WorldManager from "../../worlds/WorldManager.js";
import NpcRegistry from "../relationships/NpcRegistry.js";
import NpcSimulation from "../relationships/NpcSimulation.js";
import type { Npc } from "../relationships/Npc.js";
import type { NpcDefinition, NpcJson } from "../relationships/NpcDefinition.js";
import MailService from "../mail/MailService.js";
import { deepseekChat } from "../../core/ai/deepseek.js";
import { playerDossier } from "../playerDossier.js";
import { npcMessages, plausibleRoles, eventMessages, type NpcPromptContext } from "./prompts.js";
import { parseGeneratedNpc, toNpcDefinition } from "./generated.js";
import { parseGeneratedEvent, toEventDef } from "./generatedEvent.js";
import type { ModEventDef } from "../../types/EventJsonType.js";
import type World from "../../worlds/World.js";
import type { MailFrequency } from "../mail/mailbox.js";

/**
 * Inventing people.
 *
 * The cast of every world is a fixed list on disk; this is the one thing that
 * adds to it while a life is running, so somebody can walk into it. The shape
 * is deliberately the mail system's, because the problems are the same ones:
 *
 * - **Never block a turn.** Generation is queued and fire-and-forget; a dead
 *   network costs nothing and the player never learns it happened.
 * - **Never flood.** One arrival every few years at most, never while a choice
 *   or a popup already owns the screen, and never in the first years of a life.
 * - **Never invent a ghost.** Everything the model writes passes through
 *   `parseGeneratedNpc`, which rejects unknown roles outright — a role the game
 *   does not simulate makes a character with no behaviour at all.
 */

/** Years between new characters, by the player's AI-frequency setting. 0 = never. */
const ARRIVAL_INTERVAL: Record<MailFrequency, number> = {
  off: 0,
  low: 8,
  normal: 4,
};

/**
 * Years between invented events.
 *
 * Rarer than arrivals on purpose: a new face is a permanent addition to the
 * life, where an event is over by the next turn.
 */
const EVENT_INTERVAL: Record<MailFrequency, number> = {
  off: 0,
  low: 12,
  normal: 6,
};

/** Nobody walks into a life before it has started. */
const FIRST_ARRIVAL_AGE = 5;

/** Requests in flight at once; one is the whole rate limiter. */
const MAX_QUEUE = 2;

const LANGUAGE_NAMES: Record<string, string> = {
  zh_CN: "Chinese (Simplified)",
  en_US: "English",
  ja_JP: "Japanese",
  ru_RU: "Russian",
};

export interface GenesisSnapshot {
  /**
   * Every character this service invented, so they can be re-registered.
   *
   * Typed as what the save's schema stores rather than as `NpcDefinition[]`:
   * `npcSchema` makes `initial` and `dialogueKeys` concrete because it defaults
   * them, while the definition interface keeps them optional. Same objects, and
   * the schema is what guarantees they are well-formed on the way back in.
   */
  npcs: NpcJson[];
  /** Every event it invented, likewise — the world's pool is rebuilt on entry. */
  events: ModEventDef[];
  /** The world they belong to; invented things do not follow you between worlds. */
  worldId: string | null;
  /** Age of the last arrival and the last event, so a reload does not resend. */
  lastNpcAt: number;
  lastEventAt: number;
}

export default class GenesisService {
  private config: ConfigStore;
  private eventBus: TypedEventBus;
  private worlds: WorldManager;
  private npcs: NpcRegistry;
  private sim: NpcSimulation;
  private mail: MailService;

  private invented: NpcDefinition[] = [];
  private events: ModEventDef[] = [];
  private worldId: string | null = null;
  private lastNpcAt = -999;
  private lastEventAt = -999;

  private queue: Array<() => Promise<void>> = [];
  private running = false;

  constructor() {
    this.config = inject(ConfigStore);
    this.eventBus = inject(TypedEventBus);
    this.worlds = inject(WorldManager);
    this.npcs = inject(NpcRegistry);
    this.sim = inject(NpcSimulation);
    this.mail = inject(MailService);

    // `level:started` fires at the end of `WorldManager.start`, which is the
    // only moment at which both halves of this are true: `loadFor` has already
    // rebuilt the NPC registry and the event pool from disk (wiping anything
    // invented), and the world is current. Subscribed rather than called from
    // the world manager, which would close a dependency cycle — this service
    // reads the world manager itself.
    this.eventBus.on("level:started", ({ levelId }) => {
      let isRoot = false;
      try {
        isRoot = this.worlds.getRootWorldIds().includes(levelId);
      } catch {
        /* world not ready */
      }
      // A new life starts with nothing invented.
      if (isRoot) {
        this.reset();
        return;
      }
      // Moving between stages of one life: put the invented people and events
      // back into the freshly rebuilt registry and pool.
      this.registerPersisted(this.worlds.getCurrentWorldId());
      this.registerEventsInto(this.worlds.getCurrentWorld());
    });
  }

  /** Authored content needs the player to have opted in *and* supplied a key. */
  private enabled(): boolean {
    if (!this.config.getDeepseekApiKey()) return false;
    return ARRIVAL_INTERVAL[this.config.getMailFrequency()] > 0;
  }

  /**
   * The yearly pass. Returns at once; a new character appears when they appear.
   *
   * Called from `Game.endTurn`, so it must never touch `NpcSimulation`'s maps
   * synchronously: that tick is iterating `lives` with `for…of`, and an entry
   * inserted mid-loop would be aged and schemed in the same year it arrived.
   */
  public tickYear(player: Player): void {
    if (!this.enabled()) return;
    const year = Math.floor(player.age);
    if (year < FIRST_ARRIVAL_AGE) return;

    // Something already owns the screen. Whatever was going to happen can wait
    // a year.
    if (this.worlds.hasPendingChoice()) return;
    if (this.mail.decision()) return;

    const freq = this.config.getMailFrequency();
    const eventDue = year - this.lastEventAt >= EVENT_INTERVAL[freq];
    const npcDue = year - this.lastNpcAt >= ARRIVAL_INTERVAL[freq];
    if (!eventDue && !npcDue) return;

    // An event is the rarer occasion, so it takes the year when it is due; a
    // person is the bigger addition, so it takes every other one.
    const makeNpc = !eventDue && npcDue;
    // Reserve the slot before the async work: two arrivals in one year because
    // the first was slow would be exactly the flood this guards against.
    if (makeNpc) this.lastNpcAt = year;
    else this.lastEventAt = year;

    this.enqueue(() => (makeNpc ? this.invent(player) : this.inventEvent(player)));
  }

  /** One queued arrival: ask, validate, register, introduce. */
  private async invent(player: Player): Promise<void> {
    const year = Math.floor(player.age);
    const ctx: NpcPromptContext = {
      dossier: playerDossier(player),
      language: LANGUAGE_NAMES[this.config.getLanguage()] ?? "English",
      roles: plausibleRoles(year),
      mood: this.moodLine(player),
    };

    const result = await deepseekChat(
      this.config.getDeepseekApiKey(),
      npcMessages(ctx),
      // Warmer than the mail: this is invention, not correspondence, and a
      // careful model writes the same sensible neighbour every time.
      { temperature: 0.95, maxTokens: 600, timeoutMs: 45_000 },
    );
    if (!result.ok) {
      console.warn(`[genesis] 生成 NPC 失败: ${result.kind} ${result.error}`);
      return;
    }

    const drafted = parseGeneratedNpc(result.text);
    if (!drafted) {
      console.warn("[genesis] 生成的 NPC 不可用（角色不在已知列表，或缺名字）");
      return;
    }

    const def = toNpcDefinition(drafted, year);
    const npc = this.register(def);
    if (!npc) return;

    this.invented.push(def);
    this.eventBus.emit("toast", { textKey: "ai.npc.arrived", kind: "info" });

    // The life, the bond and the edges — none of which the registry alone gives
    // them. See `NpcSimulation.addNpc`.
    this.sim.addNpc(npc);
    // Meetable at all: an NPC is "known" only once affinity is above zero.
    player.seedRelationships([{ id: def.id, initial: def.initial }]);
    player.notify();

    // Their opening line is the introduction. It came in the same answer, so it
    // is filed directly rather than paid for with a second request.
    this.mail.fileLetter(
      player,
      def.id,
      drafted.name,
      drafted.opening || drafted.description || drafted.name,
    );
  }

  /** One queued event: ask, validate into a definition, and add it to the pool. */
  private async inventEvent(player: Player): Promise<void> {
    const year = Math.floor(player.age);
    const result = await deepseekChat(
      this.config.getDeepseekApiKey(),
      eventMessages({
        dossier: playerDossier(player),
        language: LANGUAGE_NAMES[this.config.getLanguage()] ?? "English",
        mood: this.moodLine(player),
      }),
      { temperature: 0.9, maxTokens: 400, timeoutMs: 40_000 },
    );
    if (!result.ok) {
      console.warn(`[genesis] 生成事件失败: ${result.kind} ${result.error}`);
      return;
    }

    const drafted = parseGeneratedEvent(result.text);
    if (!drafted) {
      console.warn("[genesis] 生成的事件不可用（无标题、无正文，或没有任何效果）");
      return;
    }

    const def = toEventDef(drafted, year);
    if (!def) {
      console.warn("[genesis] 生成的事件未通过事件 schema 校验");
      return;
    }

    this.events.push(def);
    // `EventCenter.add` reads the live map on every roll, so an event added
    // this turn is already eligible this year.
    this.registerEventsInto(this.worlds.getCurrentWorld());
    this.eventBus.emit("toast", { textKey: "ai.event.added", kind: "info" });
  }

  /** A plain-language nudge so the invented person fits the year they arrive in. */
  private moodLine(player: Player): string {
    const bits: string[] = [];
    if (player.health < 40) bits.push("their health is poor");
    if (player.happiness < 40) bits.push("they are unhappy");
    else if (player.happiness > 70) bits.push("life is going well for them");
    if (player.money < 50) bits.push("they are short of money");
    if (player.careerId) bits.push("they are employed");
    if (player.age > 65) bits.push("they are old");
    return bits.length > 0
      ? `At this point in their life: ${bits.join(", ")}.`
      : "It has been an ordinary year.";
  }

  /** Register a definition, tolerating one that is already there. */
  private register(def: NpcDefinition): Npc | null {
    if (this.npcs.has(def.id)) return this.npcs.get(def.id) ?? null;
    try {
      this.npcs.register(def);
    } catch (err) {
      console.warn(`[genesis] 注册 "${def.id}" 失败:`, (err as Error).message);
      return null;
    }
    return this.npcs.get(def.id) ?? null;
  }

  // ── persistence ────────────────────────────────────────────────

  /**
   * The invented cast, as the save carries it.
   *
   * The whole *definition* is stored, not just the id: a world load rebuilds
   * `NpcRegistry` from disk, and `NpcSimulation.restore` re-derives each NPC's
   * traits from its definition. An id alone would come back as a stranger with
   * default traits and none of the behaviour they had.
   */
  public snapshot(): GenesisSnapshot {
    return {
      npcs: JSON.parse(JSON.stringify(this.invented)) as NpcJson[],
      events: JSON.parse(JSON.stringify(this.events)) as ModEventDef[],
      worldId: this.worldId,
      lastNpcAt: this.lastNpcAt,
      lastEventAt: this.lastEventAt,
    };
  }

  /**
   * `npcs` is typed loosely on purpose. A parsed save hands back what
   * `npcSchema` produced, where `initial` is required because the schema
   * defaults it; `NpcDefinition` has it optional. The shapes agree in practice
   * and not nominally, so the conversion happens here, once, at the boundary.
   */
  public restore(
    snap:
      | {
          npcs?: unknown[];
          events?: unknown[];
          worldId?: string | null;
          lastNpcAt?: number;
          lastEventAt?: number;
        }
      | undefined,
  ): void {
    this.invented = (snap?.npcs ?? []) as NpcDefinition[];
    this.events = (snap?.events ?? []) as ModEventDef[];
    this.worldId = snap?.worldId ?? null;
    this.lastNpcAt = snap?.lastNpcAt ?? -999;
    this.lastEventAt = snap?.lastEventAt ?? -999;
  }

  /**
   * Put the persisted cast back into the registry.
   *
   * Called between `WorldContentLoader.loadFor` (which clears and rebuilds the
   * registry) and `NpcSimulation.restore` (which re-derives traits from it) —
   * the only window in which both facts are true.
   */
  public registerPersisted(worldId: string | null): void {
    if (this.worldId !== null && this.worldId !== worldId) return;
    for (const def of this.invented) this.register(def);
  }

  /**
   * Add the invented events to a world's pool.
   *
   * Idempotent by id, because this runs on every level entry and
   * `WorldEventLoader.registerEvent` builds a *new* incident each time — a
   * second registration of the same id would be a different instance, which
   * `EventCenter.add` rejects.
   */
  private registerEventsInto(world: World | null): void {
    if (!world) return;
    for (const def of this.events) {
      if (world.eventCenter.getIncidentById(def.id)) continue;
      world.eventLoader.registerEvent(def);
    }
  }

  /** A new life starts with nothing invented. */
  public reset(): void {
    this.invented = [];
    this.events = [];
    this.worldId = null;
    this.lastNpcAt = -999;
    this.lastEventAt = -999;
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
          console.warn("[genesis] 任务失败:", err);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
