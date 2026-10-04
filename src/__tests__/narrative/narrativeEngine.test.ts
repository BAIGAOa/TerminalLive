import { describe, it, expect } from "vitest";
import {
  activeArcs,
  arcProgress,
  ArcContext,
  ArcDef,
  emptyNarrative,
  meetsArcReq,
  tickArcs,
} from "../../world/narrative/narrativeEngine.js";

const def: ArcDef = {
  id: "a",
  labelKey: "a.title",
  stages: [
    { id: "s1", labelKey: "a.s1", requires: { minStats: { x: 10 } } },
    { id: "s2", labelKey: "a.s2", requires: { minStats: { x: 20 } } },
    { id: "s3", labelKey: "a.s3", requires: { minStats: { x: 30 } } },
  ],
};
const defs = { a: def };

const ctx = (x: number, over: Partial<ArcContext> = {}): ArcContext => ({
  age: 30,
  stats: { x },
  flags: new Set(),
  karma: {},
  maxRelationship: 0,
  careerRank: 0,
  hasCareer: false,
  ...over,
});

describe("requirements", () => {
  it("checks stats, flags, karma, bonds and career", () => {
    expect(meetsArcReq({ minStats: { x: 10 } }, ctx(9))).toBe(false);
    expect(meetsArcReq({ minStats: { x: 10 } }, ctx(10))).toBe(true);
    expect(meetsArcReq({ flags: ["f"] }, ctx(0, { flags: new Set(["f"]) }))).toBe(true);
    expect(meetsArcReq({ minKarma: { wisdom: 5 } }, ctx(0, { karma: { wisdom: 3 } }))).toBe(false);
    expect(meetsArcReq({ minRelationship: 50 }, ctx(0, { maxRelationship: 60 }))).toBe(true);
    expect(meetsArcReq({ hasCareer: true }, ctx(0))).toBe(false);
    expect(meetsArcReq(undefined, ctx(0))).toBe(true);
  });
});

describe("arc advancement", () => {
  it("start, advance, complete — never regresses", () => {
    const s = emptyNarrative();
    expect(tickArcs(s, defs, ctx(5))).toHaveLength(0); // not started
    const e1 = tickArcs(s, defs, ctx(10));
    expect(e1[0]).toMatchObject({ kind: "started", stage: 1 });
    // 25 clears stage 2 but not 3
    const e2 = tickArcs(s, defs, ctx(25));
    expect(e2.map((e) => e.stage)).toEqual([2]);
    // drop back — no regression
    expect(tickArcs(s, defs, ctx(5))).toHaveLength(0);
    expect(s.arcs.a.stage).toBe(2);
    // 35 completes it
    const e3 = tickArcs(s, defs, ctx(35));
    expect(e3[0]).toMatchObject({ kind: "completed", stage: 3 });
    // completed arcs produce no further events
    expect(tickArcs(s, defs, ctx(100))).toHaveLength(0);
  });

  it("can jump multiple stages in one tick", () => {
    const s = emptyNarrative();
    const events = tickArcs(s, defs, ctx(100));
    // starts (s1) then advances s2 and completes s3
    expect(events.map((e) => e.stage)).toEqual([1, 2, 3]);
    expect(s.arcs.a.completedAge).toBe(30);
  });
});

describe("views", () => {
  it("reports active arcs and progress", () => {
    const s = emptyNarrative();
    tickArcs(s, defs, ctx(25));
    const active = activeArcs(s, defs);
    expect(active).toHaveLength(1);
    expect(arcProgress(active[0].state, active[0].def)).toBe(67);
  });
});

describe("single-stage arcs", () => {
  it("complete the moment they start", () => {
    const one: Record<string, ArcDef> = {
      o: {
        id: "o",
        labelKey: "o.title",
        stages: [{ id: "s1", labelKey: "o.s1", requires: { minStats: { x: 1 } } }],
      },
    };
    const s = emptyNarrative();
    const events = tickArcs(s, one, ctx(5));
    expect(events[0].kind).toBe("completed");
    expect(s.arcs.o.completedAge).toBe(30);
  });
});
