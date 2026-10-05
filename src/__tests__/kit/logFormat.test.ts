import { describe, it, expect } from "vitest";
import { formatLogEntries } from "../../ui/logFormat.js";
import type { LogEntry } from "../../core/store/LogStore.js";

const t = (key: string) => `T:${key}`;

function entry(nameKey: string | undefined, id: string): LogEntry {
  return {
    timestamp: new Date("2020-01-02T03:04:05Z"),
    incident: { id, nameKey } as LogEntry["incident"],
  };
}

describe("formatLogEntries", () => {
  it("returns [] for empty or missing logs", () => {
    expect(formatLogEntries([], "en_US", t)).toEqual([]);
    expect(formatLogEntries(undefined, "en_US", t)).toEqual([]);
  });

  it("resolves names, marks the newest entry, and localizes timestamps", () => {
    const out = formatLogEntries(
      [entry("e.new", "new"), entry(undefined, "old")],
      "en_US",
      t,
    );
    expect(out[0].eventName).toBe("T:e.new");
    expect(out[0].isLatest).toBe(true);
    expect(out[1].eventName).toBe("T:old");
    expect(out[1].isLatest).toBe(false);
    expect(out[0].timestamp).toBeTypeOf("string");
    expect(out[0].timestamp.length).toBeGreaterThan(0);
  });
});
