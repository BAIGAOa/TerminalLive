import { describe, it, expect } from "vitest";
import { digestJournal, JOURNAL_LINES } from "../../world/mail/journal.js";
import { NpcLogIncident } from "../../world/relationships/NpcLogIncident.js";
import { Incident, type IncidentParameter } from "../../world/Incident.js";
import type Player from "../../world/Player.js";
import type { LogEntry } from "../../core/store/LogStore.js";

/** A concrete incident for the player's own journal lines (the base is abstract). */
class OwnLog extends Incident {
  public apply(_player: Player): void {}
}

function own(id: string, nameKey?: string): LogEntry {
  return {
    incident: new OwnLog({ id, nameKey } as IncidentParameter),
    timestamp: new Date(0),
  };
}

function npc(id: string, nameKey?: string): LogEntry {
  return { incident: new NpcLogIncident(id, nameKey!), timestamp: new Date(0) };
}

/** A translator that makes its own use visible, so "was it translated" is provable. */
const t = (key: string): string => `«${key}»`;

describe("digestJournal", () => {
  it("returns two empty lists for an empty journal", () => {
    expect(digestJournal([], t)).toEqual({ own: [], around: [] });
  });

  it("translates every line rather than passing the key through", () => {
    const digest = digestJournal([own("e1", "event.storm")], t);
    expect(digest.own).toEqual(["«event.storm»"]);
  });

  it("falls back to the incident id when there is no nameKey", () => {
    const digest = digestJournal([own("plain_id")], t);
    expect(digest.own).toEqual(["«plain_id»"]);
  });

  it("files an NPC's life event under `around`, not `own`", () => {
    const digest = digestJournal([npc("npc_log_1", "npc.life.promote")], t);
    expect(digest.around).toEqual(["«npc.life.promote»"]);
    expect(digest.own).toEqual([]);
  });

  it("keeps the two kinds apart in the mixed case that caused the bug", () => {
    // The real shape of the year that produced "Mike, you were promoted" for a
    // two-year-old: two NPC life events beside the player's own.
    const digest = digestJournal(
      [
        npc("npc_log_2", "npc.life.promote"),
        npc("npc_log_1", "npc.life.illness"),
        own("ev_born", "event.birth"),
      ],
      t,
    );
    expect(digest.around).toEqual(["«npc.life.promote»", "«npc.life.illness»"]);
    expect(digest.own).toEqual(["«event.birth»"]);
  });

  it("preserves the newest-first order within each list", () => {
    const digest = digestJournal(
      [own("e1", "a"), npc("npc_log_1", "b"), own("e2", "c")],
      t,
    );
    expect(digest.own).toEqual(["«a»", "«c»"]);
    expect(digest.around).toEqual(["«b»"]);
  });

  it("reads only the newest `limit` entries", () => {
    const entries = Array.from({ length: JOURNAL_LINES + 4 }, (_, i) =>
      own(`e${i}`, `k${i}`),
    );
    const digest = digestJournal(entries, t);
    expect(digest.own).toHaveLength(JOURNAL_LINES);
    expect(digest.own[0]).toBe("«k0»");
    expect(digest.own).not.toContain("«k8»");
  });

  it("honours an explicit limit", () => {
    const digest = digestJournal([own("e0", "a"), npc("npc_log_1", "b"), own("e1", "c")], t, 1);
    expect(digest.own).toEqual(["«a»"]);
    expect(digest.around).toEqual([]);
  });

  it("does not mutate the entries it is given", () => {
    const entries = [own("e0", "a"), npc("npc_log_1", "b")];
    const before = entries.map((e) => e.incident.id);
    digestJournal(entries, t);
    expect(entries.map((e) => e.incident.id)).toEqual(before);
  });
});
