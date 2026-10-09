import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import EventCenter from "../../event/EventCenter.js";
import EventHistory from "../../event/EventHistory.js";
import ChainTracker from "../../event/ChainTracker.js";
import LogStore from "../../core/store/LogStore.js";
import PluginHost from "../../core/plugin/PluginHost.js";
import DefaultEventAlgorithm from "../../event/DefaultEventAlgorithm.js";
import { Incident } from "../../world/Incident.js";
import Player from "../../world/Player.js";

/** A minimal incident that counts how many times it actually executes. */
class CountingEvent extends Incident {
  public runs = 0;
  public apply(_player: Player): void {
    this.runs++;
  }
}

function build(center: EventCenter, history = new EventHistory()) {
  const algo = new DefaultEventAlgorithm({
    eventCenter: center,
    logStore: new LogStore(),
    eventHistory: history,
    pluginHost: container.resolve(PluginHost),
  });
  return { algo, history };
}

describe("DefaultEventAlgorithm — post-event graphs", () => {
  beforeEach(() => container.resolve(ChainTracker).reset());

  it("survives snapshot → restore and fires the same queued event later", () => {
    const center = new EventCenter();
    const a = new CountingEvent({
      id: "A",
      rangeKey: ["10-12"],
      once: true,
      postEvent: [{ incident: "B", delay: 2 }],
    });
    const b = new CountingEvent({ id: "B", rangeKey: ["200-201"] });
    center.add("10-12", a);
    center.add("200-201", b);
    const history = new EventHistory();
    const { algo } = build(center, history);
    const p = new Player({ age: 10 });

    algo.forceNextEvent("A");
    algo.trigger(p);
    expect(a.runs).toBe(1);

    const snap = algo.snapshotPostEvents();
    expect(snap).toHaveLength(1);
    expect(snap[0]).toMatchObject({ sourceId: "A", targetId: "B", delay: 2, edgeIndex: 0 });
    // Undefined optional fields are dropped by JSON, hence toEqual not strict.
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);

    // A fresh algorithm (as after a reload) starts with an empty queue.
    const { algo: reloaded } = build(center, history);
    reloaded.restorePostEvents(snap);

    reloaded.trigger(p); // delay 2 -> 1
    expect(b.runs).toBe(0);
    reloaded.trigger(p); // delay 1 -> 0
    expect(b.runs).toBe(0);
    reloaded.trigger(p); // fires
    expect(b.runs).toBe(1);
  });

  it("honours an edge maxRuns > 1 instead of forcing post targets once-only", () => {
    const center = new EventCenter();
    const source = new CountingEvent({
      id: "S",
      rangeKey: ["10-12"],
      once: false,
      postEvent: [{ incident: "T", maxRuns: 2, edgeId: "s->t" }],
    });
    const target = new CountingEvent({ id: "T", rangeKey: ["200-201"] });
    center.add("10-12", source);
    center.add("200-201", target);
    const { algo } = build(center);
    const p = new Player({ age: 10 });

    const runOnce = () => {
      algo.forceNextEvent("S");
      algo.trigger(p); // S fires, queues T
      algo.trigger(p); // T fires
    };

    runOnce();
    expect(target.runs).toBe(1);
    runOnce();
    expect(target.runs).toBe(2);

    // The edge is exhausted: a third source fire queues nothing.
    algo.forceNextEvent("S");
    algo.trigger(p);
    algo.trigger(p);
    expect(target.runs).toBe(2);
  });

  it("lets two source edges converge on the same post target", () => {
    const center = new EventCenter();
    const a = new CountingEvent({
      id: "A",
      rangeKey: ["10-12"],
      once: true,
      postEvent: [{ incident: "T", edgeId: "a->t" }],
    });
    const c = new CountingEvent({
      id: "C",
      rangeKey: ["10-12"],
      once: true,
      postEvent: [{ incident: "T", edgeId: "c->t" }],
    });
    const t = new CountingEvent({ id: "T", rangeKey: ["200-201"] });
    center.add("10-12", a);
    center.add("10-12", c);
    center.add("200-201", t);
    const { algo } = build(center);
    const p = new Player({ age: 10 });

    algo.forceNextEvent("A");
    algo.trigger(p); // A queues T
    algo.trigger(p); // T fires (1)
    expect(t.runs).toBe(1);

    algo.forceNextEvent("C");
    algo.trigger(p); // C queues T — a different edge, so still open
    algo.trigger(p); // T fires (2) instead of being blanket-dropped
    expect(t.runs).toBe(2);
  });

  it("clamps a window-overrun instead of silently dropping it", () => {
    const center = new EventCenter();
    const source = new CountingEvent({
      id: "S",
      rangeKey: ["10-12"],
      once: true,
      postEvent: [{ incident: "T", delay: 1, maxAge: 10 }],
    });
    const target = new CountingEvent({ id: "T", rangeKey: ["200-201"] });
    center.add("10-12", source);
    center.add("200-201", target);
    const { algo } = build(center);
    const p = new Player({ age: 10 });

    algo.forceNextEvent("S");
    algo.trigger(p); // queues T while maxAge == age

    p.age = 11; // the delay pushed past the edge window
    algo.trigger(p); // delay 1 -> 0
    expect(target.runs).toBe(0);
    algo.trigger(p); // now past maxAge — must still fire, not vanish
    expect(target.runs).toBe(1);
  });

  it("retries a condition-gated step rather than dropping it", () => {
    let ready = true;
    const center = new EventCenter();
    const source = new CountingEvent({
      id: "S",
      rangeKey: ["10-12"],
      once: true,
      postEvent: [{ incident: "T", triggerCondition: () => ready }],
    });
    const target = new CountingEvent({ id: "T", rangeKey: ["200-201"] });
    center.add("10-12", source);
    center.add("200-201", target);
    const { algo } = build(center);
    const p = new Player({ age: 10 });

    algo.forceNextEvent("S");
    algo.trigger(p); // passed the gate at selection, queued

    ready = false;
    algo.trigger(p); // gate now false → retry, not drop
    expect(target.runs).toBe(0);

    ready = true;
    algo.trigger(p); // fires
    expect(target.runs).toBe(1);
  });

  it("dedupes an incident declared across overlapping ranges", () => {
    const center = new EventCenter();
    const e = new CountingEvent({
      id: "E",
      rangeKey: ["0-10", "5-15"],
    });
    center.add("0-10", e);
    center.add("5-15", e); // same instance, two ranges, both cover age 7
    const { algo } = build(center);

    const matched = algo.getMatchedIncidents(7);
    expect(matched.filter((m) => m.incident.id === "E")).toHaveLength(1);
    // Outside the overlap each range still contributes normally.
    expect(algo.getMatchedIncidents(3).filter((m) => m.incident.id === "E")).toHaveLength(1);
    expect(algo.getMatchedIncidents(12).filter((m) => m.incident.id === "E")).toHaveLength(1);
  });

  it("re-resolves the edge of a restored item from content", () => {
    const center = new EventCenter();
    const source = new CountingEvent({
      id: "S",
      rangeKey: ["10-12"],
      once: true,
      postEvent: [
        { incident: "other", edgeId: "x" },
        { incident: "T", edgeId: "s->t-restored", maxRuns: 1 },
      ],
    });
    const target = new CountingEvent({ id: "T", rangeKey: ["200-201"] });
    center.add("10-12", source);
    center.add("200-201", target);
    const history = new EventHistory();
    // Keep S out of ordinary rolls; this test only exercises its edges.
    history.markTriggered("S", "10-12", 10);

    // The queue only stores { sourceId, edgeIndex }; the algorithm looks the
    // edge (and its maxRuns/once) back up from the source incident's content.
    const { algo: reloaded } = build(center, history);
    reloaded.restorePostEvents([
      { sourceId: "S", targetId: "T", delay: 0, edgeIndex: 1 },
    ]);
    const p = new Player({ age: 10 });
    reloaded.trigger(p);
    expect(target.runs).toBe(1);

    // And the edge's maxRuns is enforced after the restore.
    expect(container.resolve(ChainTracker).snapshot().runs["S:s->t-restored:1"]).toBe(1);
    reloaded.restorePostEvents([
      { sourceId: "S", targetId: "T", delay: 0, edgeIndex: 1 },
    ]);
    reloaded.trigger(p);
    expect(target.runs).toBe(1);
  });
});
