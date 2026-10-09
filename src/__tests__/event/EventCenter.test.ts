import { describe, it, expect } from "vitest";
import EventCenter from "../../event/EventCenter.js";
import { Incident } from "../../world/Incident.js";
import Player from "../../world/Player.js";

class StubEvent extends Incident {
  public apply(_player: Player): void {
    /* no-op */
  }
}

describe("EventCenter", () => {
  it("keeps the id index while the incident is still registered in another range", () => {
    const center = new EventCenter();
    const e = new StubEvent({ id: "ev", rangeKey: ["0-10", "5-15"] });
    // WorldEventLoader registers the SAME instance once per declared range.
    center.add("0-10", e);
    center.add("5-15", e);

    expect(center.getIncidentById("ev")).toBe(e);

    center.remove("0-10", "ev");
    expect(center.getIncidentsByRange("0-10")?.size).toBe(0);
    expect(center.getIncidentsByRange("5-15")?.has(e)).toBe(true);
    // Still reachable by id for the remaining range (and post-event lookups).
    expect(center.getIncidentById("ev")).toBe(e);

    center.remove("5-15", "ev");
    expect(center.getIncidentById("ev")).toBeUndefined();
  });

  it("lists each incident id once, however many ranges hold it", () => {
    const center = new EventCenter();
    const multi = new StubEvent({ id: "ev_a", rangeKey: ["0-10", "5-15"] });
    center.add("0-10", multi);
    center.add("5-15", multi);
    center.add("0-10", new StubEvent({ id: "ev_b", rangeKey: ["0-10"] }));

    // Same set `getIncidentById` accepts — what `force-event` completes from.
    expect(center.getAllIncidentIds().sort()).toEqual(["ev_a", "ev_b"]);

    // Dropping one range still leaves the id listed (it is live elsewhere),
    // and it disappears only when the last range lets go.
    center.remove("0-10", "ev_a");
    expect(center.getAllIncidentIds()).toContain("ev_a");
    center.remove("5-15", "ev_a");
    expect(center.getAllIncidentIds()).not.toContain("ev_a");
  });

  it("rejects a duplicate id registered as a different instance", () => {
    const center = new EventCenter();
    center.add("0-10", new StubEvent({ id: "ev", rangeKey: ["0-10"] }));
    expect(() =>
      center.add("5-15", new StubEvent({ id: "ev", rangeKey: ["5-15"] })),
    ).toThrow();
  });
});
