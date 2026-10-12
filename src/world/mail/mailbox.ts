/**
 * The mailbox and the rules that keep it from becoming spam.
 *
 * Pure state transitions — every operation returns a new box — so the "how
 * often may the AI speak" policy is decided here, in one readable place,
 * rather than scattered through the service that calls the model.
 */

import { demandsAnswer, type Letter } from "./letter.js";

export interface Mailbox {
  letters: Letter[];
  /** npcId → the age at which that NPC may write again. */
  cooldowns: Record<string, number>;
  /** The year the counters below belong to. */
  countedYear: number;
  /** Letters generated during `countedYear`. */
  sentThisYear: number;
  /**
   * The last year a letter carried a question. At most one per year may do
   * that, which is what stops the game from queueing up modal dialogs.
   */
  lastDecisionYear: number;
  /** The year `repliesThisYear` belongs to. */
  replyYear: number;
  /** Letters an NPC wrote *back* during `replyYear`. */
  repliesThisYear: number;
}

/** How many letters the box keeps before the coldest ones are dropped. */
export const MAILBOX_CAP = 40;

/**
 * Write-backs allowed per year, on top of the initiation budget.
 *
 * Answering a stack of old letters should not fire a stack of requests, so the
 * number of *conversational* turns a year is capped separately from how many
 * characters may strike up a new subject.
 */
export const MAX_REPLIES_PER_YEAR = 2;

export function emptyMailbox(): Mailbox {
  return {
    letters: [],
    cooldowns: {},
    countedYear: -1,
    sentThisYear: 0,
    lastDecisionYear: -1,
    replyYear: -1,
    repliesThisYear: 0,
  };
}

/** How talkative the AI is allowed to be. */
export type MailFrequency = "off" | "low" | "normal";

export interface FrequencyBudget {
  /** Letters that may be generated in a single year. */
  perYear: number;
  /** Years an NPC must wait after writing. */
  npcCooldown: number;
  /** Below this affinity, an NPC simply does not know the player well enough. */
  minAffinity: number;
}

export function budgetFor(frequency: MailFrequency): FrequencyBudget {
  switch (frequency) {
    case "off":
      return { perYear: 0, npcCooldown: 99, minAffinity: 999 };
    case "low":
      // One voice a year, and nobody writes twice in a decade of game time.
      return { perYear: 1, npcCooldown: 4, minAffinity: 40 };
    default:
      return { perYear: 2, npcCooldown: 2, minAffinity: 30 };
  }
}

/** How many letters may still be generated this year. */
export function remainingThisYear(box: Mailbox, year: number, budget: FrequencyBudget): number {
  const used = box.countedYear === year ? box.sentThisYear : 0;
  return Math.max(0, budget.perYear - used);
}

/** Whether `npcId` is off cooldown at `year`. */
export function canWrite(box: Mailbox, npcId: string, year: number): boolean {
  const until = box.cooldowns[npcId];
  return until === undefined || year >= until;
}

/** How many write-backs are still allowed this year. */
export function repliesRemaining(box: Mailbox, year: number): number {
  const used = box.replyYear === year ? box.repliesThisYear : 0;
  return Math.max(0, MAX_REPLIES_PER_YEAR - used);
}

/** Record that an NPC answered back. */
export function noteReply(box: Mailbox, year: number): Mailbox {
  return {
    ...box,
    replyYear: year,
    repliesThisYear: (box.replyYear === year ? box.repliesThisYear : 0) + 1,
  };
}

export interface WriterCandidate {
  npcId: string;
  affinity: number;
  /** 0…1 — a decisive character pushes for an answer, and is likelier to write. */
  decisive: number;
}

/**
 * Who writes this year.
 *
 * Weighted without replacement: warmer relationships and more driven
 * personalities come up more often, but the per-year budget is the hard cap —
 * a mailbox that fills itself every turn is the failure mode this exists to
 * prevent.
 */
export function chooseWriters(
  candidates: readonly WriterCandidate[],
  box: Mailbox,
  year: number,
  budget: FrequencyBudget,
  rng: () => number,
): string[] {
  let slots = remainingThisYear(box, year, budget);
  if (slots <= 0) return [];

  const pool = candidates
    .filter((c) => c.affinity >= budget.minAffinity && canWrite(box, c.npcId, year))
    .map((c) => ({
      id: c.npcId,
      // Affinity dominates; decisiveness breaks ties among equally close ties.
      weight: Math.max(1, c.affinity) * (0.6 + c.decisive * 0.8),
    }));
  if (pool.length === 0) return [];

  const picked: string[] = [];
  while (slots > 0 && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(pool[index].id);
    pool.splice(index, 1);
    slots -= 1;
  }
  return picked;
}

/** Record that a letter was generated, and close the author's cooldown. */
export function noteSent(
  box: Mailbox,
  npcId: string,
  year: number,
  budget: FrequencyBudget,
): Mailbox {
  return {
    ...box,
    countedYear: year,
    sentThisYear: (box.countedYear === year ? box.sentThisYear : 0) + 1,
    cooldowns: { ...box.cooldowns, [npcId]: year + budget.npcCooldown },
  };
}

/** Insert a letter, dropping the oldest *read* letters past the cap. */
export function addLetter(box: Mailbox, letter: Letter, cap = MAILBOX_CAP): Mailbox {
  const letters = [letter, ...box.letters];
  if (letters.length <= cap) return { ...box, letters };

  // Never drop something the player has not answered: an unanswered letter is
  // still a live promise, a read one is just paper.
  const keep = [...letters];
  for (let i = keep.length - 1; i >= 0 && keep.length > cap; i--) {
    if (keep[i].status !== "unread") keep.splice(i, 1);
  }
  // Still over the cap: everything left is unread, so drop the oldest anyway.
  return { ...box, letters: keep.slice(0, cap) };
}

export function unreadCount(box: Mailbox): number {
  return box.letters.filter((l) => l.status === "unread").length;
}

/** Unanswered decisions — the only letters allowed to interrupt the player. */
export function openDecisions(box: Mailbox): Letter[] {
  return box.letters.filter(demandsAnswer);
}

/** The one decision that should pop up now, oldest first. */
export function nextDecision(box: Mailbox): Letter | null {
  const open = openDecisions(box);
  return open.length > 0 ? open[open.length - 1] : null;
}

export function markRead(box: Mailbox, id: string): Mailbox {
  return {
    ...box,
    letters: box.letters.map((l) =>
      l.id === id && l.status === "unread" ? { ...l, status: "read" } : l,
    ),
  };
}

/**
 * Close a letter out. A letter with choices stays `answered` only once one was
 * picked; a plain letter can be answered with prose alone.
 */
export function answerLetter(
  box: Mailbox,
  id: string,
  reply: string | undefined,
  chosen: string | undefined,
): Mailbox {
  return {
    ...box,
    letters: box.letters.map((l) =>
      l.id === id
        ? { ...l, status: "answered", reply: reply ?? l.reply, chosen: chosen ?? l.chosen }
        : l,
    ),
  };
}

/** Newest first, unread ahead of the rest — the order the inbox draws. */
export function sortedLetters(box: Mailbox): Letter[] {
  const rank = (l: Letter) => (l.status === "unread" ? 0 : l.status === "answered" ? 2 : 1);
  return [...box.letters].sort(
    (a, b) => rank(a) - rank(b) || b.year - a.year,
  );
}
