import { describe, it, expect } from "vitest";
import {
  absorbMarketBias,
  ChainContext,
  ChainDef,
  emptyChainState,
  requirementsMet,
  startChain,
  tickChains,
} from "../../world/chains/worldChainEngine.js";

const def: ChainDef = {
  id: "c",
  labelKey: "c.title",
  triggerYear: 1,
  start: "a",
  nodes: {
    a: { id: "a", labelKey: "a", delay: 0, effects: { pressures: { p: 1 } }, next: ["b"] },
    b: {
      id: "b",
      labelKey: "b",
      delay: 2,
      requires: { minPressure: { axis: "x", gte: 50 } },
      effects: { marketBias: 0.05 },
    },
  },
};
const defs = { c: def };

const ctx = (year: number, over: Partial<ChainContext> = {}): ChainContext => ({
  year,
  flags: new Set(),
  pressures: {},
  standing: {},
  ...over,
});

describe("requirement gating", () => {
  it("checks flags, pressure and standing", () => {
    expect(requirementsMet(undefined, ctx(1))).toBe(true);
    expect(
      requirementsMet({ flags: ["f"] }, ctx(1, { flags: new Set(["f"]) })),
    ).toBe(true);
    expect(requirementsMet({ flags: ["f"] }, ctx(1))).toBe(false);
    expect(
      requirementsMet({ minPressure: { axis: "x", gte: 10 } }, ctx(1, { pressures: { x: 5 } })),
    ).toBe(false);
    expect(
      requirementsMet({ minStanding: { faction: "g", gte: 10 } }, ctx(1, { standing: { g: 20 } })),
    ).toBe(true);
  });
});

describe("chains", () => {
  it("starts at the trigger year and cascades with delays", () => {
    const s = emptyChainState();
    // year 0: not yet triggered
    expect(tickChains(s, defs, ctx(0))).toHaveLength(0);
    // year 1: chain starts, node "a" fires, "b" scheduled for year 3
    const e1 = tickChains(s, defs, ctx(1));
    expect(e1.map((e) => e.nodeId)).toEqual(["a"]);
    expect(s.started).toContain("c");
    expect(s.active[0]).toMatchObject({ nodeId: "b", dueYear: 3 });
    // year 2: b not due yet
    expect(tickChains(s, defs, ctx(2))).toHaveLength(0);
  });

  it("holds a due node until its requirement is met, then fires once", () => {
    const s = emptyChainState();
    tickChains(s, defs, ctx(1)); // a fired, b due year 3
    expect(tickChains(s, defs, ctx(3))).toHaveLength(0); // x missing
    const fired = tickChains(s, defs, ctx(3, { pressures: { x: 60 } }));
    expect(fired.map((e) => e.nodeId)).toEqual(["b"]);
    expect(s.fired).toContain("c:b");
    // never fires twice
    expect(tickChains(s, defs, ctx(4, { pressures: { x: 60 } }))).toHaveLength(0);
  });

  it("startChain is idempotent", () => {
    const s = emptyChainState();
    expect(startChain(s, def, 1)).toBe(true);
    expect(startChain(s, def, 1)).toBe(false);
    expect(s.active).toHaveLength(1);
  });
});

describe("market aftermath", () => {
  it("accumulates and decays", () => {
    const s = emptyChainState();
    absorbMarketBias(s, 0.1);
    expect(s.marketBias).toBeCloseTo(0.1);
    tickChains(s, defs, ctx(0));
    expect(s.marketBias).toBeLessThan(0.1);
    absorbMarketBias(s, 1); // clamped
    expect(s.marketBias).toBeLessThanOrEqual(0.2);
  });
});
