import type { LogEntry } from "../core/store/LogStore.js";

/** Pure formatting of journal log entries (React-free). */

export type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export interface LogDisplayEntry {
  timestamp: string;
  eventName: string;
  isLatest: boolean;
}

/**
 * Turn raw log entries into the display rows the journal renders: a localized
 * timestamp, the resolved event name, and whether it is the newest entry.
 */
export function formatLogEntries(
  rawLogs: readonly LogEntry[] | undefined,
  langCode: string,
  t: Translator,
): LogDisplayEntry[] {
  if (!rawLogs?.length) return [];
  const locale = langCode.replace("_", "-");
  return rawLogs.map((entry, index) => ({
    timestamp: entry.timestamp.toLocaleString(locale),
    eventName: t(entry.incident.nameKey ?? entry.incident.id),
    isLatest: index === 0,
  }));
}
