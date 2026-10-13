/**
 * What an NPC's letter is, and how the model's answer becomes one.
 *
 * Everything the AI says arrives here first and is validated into this shape:
 * bounded lengths, a bounded number of choices, and a bounded affinity swing.
 * The model is allowed to write prose and propose a small decision; it is not
 * allowed to hand the game arbitrary numbers.
 */

import stringWidth from "string-width";

/** A decision the NPC is asking the player to make. */
export interface MailChoice {
  id: string;
  /** The option, as written by the NPC. */
  label: string;
  /** How this swings the relationship, clamped to a small band. */
  affinity: number;
}

export type LetterStatus = "unread" | "read" | "answered";

export interface Letter {
  id: string;
  /** Who wrote it. */
  npcId: string;
  /** Player age when it arrived. */
  year: number;
  subject: string;
  body: string;
  /** Non-empty when the NPC demands an answer — only these may pop a modal. */
  choices: MailChoice[];
  status: LetterStatus;
  /**
   * How far into the exchange this letter is. 0 is the NPC starting it; 1 is
   * their answer back. Capped (see `MAX_THREAD_DEPTH`) so a conversation can
   * never turn into a loop the player cannot leave.
   */
  depth: number;
  /** The player's written reply, once given. */
  reply?: string;
  /** The chosen option's id, once decided. */
  chosen?: string;
}

/** Bounds the model cannot talk its way past. */
export const MAX_CHOICES = 3;
export const MAX_AFFINITY_SWING = 8;
export const MAX_SUBJECT = 48;
/**
 * A runaway guard, not a display limit.
 *
 * The letter is shown in a scrollable window, so a long one costs nothing to
 * read and is never cut — the only reason to bound it at all is to keep a
 * malfunctioning model from writing a megabyte into the save file. The prompt
 * asks for "2 to 5 sentences", and this sits far above the longest thing that
 * request plausibly produces, so a character who genuinely has a lot to say is
 * never edited down. Total storage is bounded separately, by the mailbox's byte
 * budget (see `MAIL_LETTERS_MAX_BYTES`).
 */
export const MAX_BODY = 2000;
/**
 * Cells one rendered line may occupy, for the parts the UI shows on a single
 * row: the subject, and a choice's label. The inbox and the decision popup are
 * fixed-width, and a row that overflows is simply cut off — so the cut is made
 * here, deliberately, where it can be marked.
 */
export const SUBJECT_CELLS = 44;
export const CHOICE_CELLS = 58;

/** How many times an NPC may answer back within one thread. */
export const MAX_THREAD_DEPTH = 1;

function clampAffinity(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(-MAX_AFFINITY_SWING, Math.min(MAX_AFFINITY_SWING, Math.round(n)));
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // Models like to wrap prose in quotes or markdown; neither belongs in a
  // letter rendered into a terminal panel.
  return value
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .trim()
    .slice(0, max);
}

/**
 * Fit `text` into `cells` terminal columns, marking the cut.
 *
 * Widths are cells, not characters: a dozen Chinese characters are already
 * wider than a narrow panel, so a character-count limit would let content run
 * off the edge. Wide glyphs are never split.
 */
export function clampCells(text: string, cells: number): string {
  if (stringWidth(text) <= cells) return text;
  let out = "";
  let used = 0;
  for (const ch of text) {
    const w = stringWidth(ch);
    // One cell is held back for the ellipsis that says "there was more".
    if (used + w > cells - 1) break;
    out += ch;
    used += w;
  }
  return `${out}…`;
}

export interface ParsedLetter {
  subject: string;
  body: string;
  choices: MailChoice[];
}

/** The JSON object inside a model answer, prose and code fences included. */
function readObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Validate one parsed object into a letter, or null when it carries no body. */
function toLetter(
  obj: Record<string, unknown>,
  npcName: string,
): ParsedLetter | null {
  const body = clean(obj.body, MAX_BODY);
  if (!body) return null;

  const rawChoices = Array.isArray(obj.choices) ? obj.choices : [];
  const choices: MailChoice[] = rawChoices
    .slice(0, MAX_CHOICES)
    .map((c, i) => {
      const item = (c ?? {}) as Record<string, unknown>;
      return {
        id: `c${i + 1}`,
        // Options are picked from a one-row list, so they are fitted to one row.
        label: clampCells(clean(item.label, 120), CHOICE_CELLS),
        affinity: clampAffinity(item.affinity),
      };
    })
    .filter((c) => c.label.length > 0);

  const subject = clean(obj.subject, MAX_SUBJECT);
  return {
    subject: subject ? clampCells(subject, SUBJECT_CELLS) : `— ${npcName}`,
    body,
    // A single choice is not a decision, it is a sentence with a button.
    choices: choices.length >= 2 ? choices : [],
  };
}

/**
 * Read the model's answer into a letter.
 *
 * A model that wraps its JSON in prose is normal, so the object is located
 * rather than strictly parsed. Anything unreadable still produces a letter —
 * a blank envelope would be worse than a plain sentence.
 */
export function parseLetter(raw: string, npcName: string): ParsedLetter {
  const obj = readObject(raw);
  if (obj) {
    const letter = toLetter(obj, npcName);
    if (letter) return letter;
  }
  const fallback = clean(raw, MAX_BODY);
  return {
    subject: `— ${npcName}`,
    body: fallback || "...",
    choices: [],
  };
}

/**
 * Read a letter the character was allowed to *not* write.
 *
 * Used for replies: the prompt tells the character they may decide the matter
 * is closed, and they say so either by returning `{"silent": true}` or by
 * leaving the body empty. `null` means "they had nothing more to say", which
 * is a normal outcome, not a failure.
 */
export function parseOptionalLetter(
  raw: string,
  npcName: string,
): ParsedLetter | null {
  const obj = readObject(raw);
  if (obj) {
    if (obj.silent === true) return null;
    return toLetter(obj, npcName);
  }
  const fallback = clean(raw, MAX_BODY);
  return fallback ? { subject: `— ${npcName}`, body: fallback, choices: [] } : null;
}

/** A letter that expects an answer rather than a read. */
export function demandsAnswer(letter: Letter): boolean {
  return letter.choices.length > 0 && letter.chosen === undefined;
}
