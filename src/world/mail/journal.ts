import type { TranslateFn } from "../../core/repl/types.js";
import type { LogEntry } from "../../core/store/LogStore.js";
import { NpcLogIncident } from "../relationships/NpcLogIncident.js";

/** How many of the year's happenings the writer is told about. */
export const JOURNAL_LINES = 6;

/**
 * The year, split by whose life it happened in.
 *
 * The journal holds two very different kinds of entry: things that happened to
 * the player, and things that happened to the people around them — every
 * `npc.life.*` line is somebody *else's* marriage, illness or promotion. Handing
 * both to the model under a single heading is how a two-year-old gets
 * congratulated on a promotion: it has no way to tell whose year it is reading,
 * so it attributes everything to the person it is writing to.
 */
export interface JournalDigest {
  /** What happened to the player. */
  own: string[];
  /** What happened to the people around them. */
  around: string[];
}

/**
 * Read the newest few journal entries into two lists of plain, translated
 * lines. `entries` arrive newest-first, which is the order they are shown in.
 */
export function digestJournal(
  entries: readonly LogEntry[],
  t: TranslateFn,
  limit: number = JOURNAL_LINES,
): JournalDigest {
  const own: string[] = [];
  const around: string[] = [];
  for (const entry of entries.slice(0, limit)) {
    // `nameKey` is a translation key, not prose — every reader of the journal
    // has to translate it, and this one is no exception.
    const line = t(entry.incident.nameKey ?? entry.incident.id);
    if (entry.incident instanceof NpcLogIncident) around.push(line);
    else own.push(line);
  }
  return { own, around };
}
