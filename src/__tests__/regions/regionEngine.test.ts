import { describe, it, expect } from "vitest";
import { container } from "../../Container.js";
import ChronicleRegistry from "../../world/chronicle/ChronicleRegistry.js";
import RegionsSystem from "../../world/regions/RegionsSystem.js";
import {
  bestRegion,
  canMove,
  emptyRegions,
  moveTo,
  neighborsOf,
  prosperityTier,
  regionMoodDelta,
  tickRegions,
} from "../../world/regions/regionEngine.js";

const fixed = (v: number) => () => v;
const adj = { a: ["b"], b: ["a", "c"], c: ["b"] };

describe("setup", () => {
  it("seeds every region and records the starting visit", () => {
    const s = emptyRegions([{ id: "a" }, { id: "b" }], "a");
    expect(Object.keys(s.regions)).toEqual(["a", "b"]);
    expect(s.currentId).toBe("a");
    expect(s.visits.a).toBe(1);
  });
});

describe("migration feasibility", () => {
  it("only allows moving to a neighbour", () => {
    const s = emptyRegions([{ id: "a" }, { id: "b" }, { id: "c" }], "a");
    expect(canMove(s, "b", adj)).toBe(true);
    expect(canMove(s, "c", adj)).toBe(false);
    expect(canMove(s, "zzz", adj)).toBe(false);
  });

  it("records a move and its visit count", () => {
    const s = emptyRegions([{ id: "a" }, { id: "b" }], "a");
    const events = moveTo(s, "b");
    expect(s.currentId).toBe("b");
    expect(s.visits.b).toBe(1);
    moveTo(s, "a");
    expect(s.visits.a).toBe(2);
    expect(events[0].kind).toBe("region.moved");
  });

  it("lists neighbours", () => {
    expect(neighborsOf(adj, "b")).toEqual(["a", "c"]);
    expect(neighborsOf(adj, "missing")).toEqual([]);
  });
});

describe("yearly drift", () => {
  it("keeps all gauges within range and can boom", () => {
    const s = emptyRegions([{ id: "a" }], "a");
    s.regions.a.prosperity = 90;
    const events = tickRegions(s, { a: [] }, fixed(0));
    const r = s.regions.a;
    for (const v of [r.prosperity, r.population, r.stability, r.development]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(events.some((e) => e.kind === "region.boom")).toBe(true);
  });

  it("drags a poor region toward turmoil", () => {
    const s = emptyRegions([{ id: "a" }], "a");
    s.regions.a.prosperity = 10;
    s.regions.a.stability = 10;
    const events = tickRegions(s, { a: [] }, fixed(0));
    expect(events.some((e) => e.kind === "region.turmoil")).toBe(true);
  });
});

describe("RegionsSystem restore", () => {
  it("rebuilds adjacency from the registry on restore (no reset needed)", () => {
    const reg = container.resolve(ChronicleRegistry);
    if (!reg.getRegion("t_reg_a")) {
      reg.registerRegion({ id: "t_reg_a", labelKey: "t_reg_a", descKey: "", neighbors: ["t_reg_b"] });
      reg.registerRegion({ id: "t_reg_b", labelKey: "t_reg_b", descKey: "", neighbors: ["t_reg_a"] });
    }
    const sys = container.resolve(RegionsSystem);
    const mk = (id: string) => ({ id, prosperity: 50, population: 50, stability: 50, development: 30 });
    sys.restore({
      regions: { t_reg_a: mk("t_reg_a"), t_reg_b: mk("t_reg_b") },
      currentId: "t_reg_a",
      visits: { t_reg_a: 1 },
    });
    expect(sys.getAdjacency().t_reg_a).toEqual(["t_reg_b"]);
    expect(sys.neighbors("t_reg_a")).toEqual(["t_reg_b"]);
    expect(canMove(sys.getState(), "t_reg_b", sys.getAdjacency())).toBe(true);
  });
});

describe("aggregates", () => {
  it("classifies prosperity tiers", () => {
    expect(prosperityTier({ id: "x", prosperity: 90, population: 0, stability: 0, development: 0 })).toBe(
      "region.tier.thriving",
    );
    expect(prosperityTier({ id: "x", prosperity: 10, population: 0, stability: 0, development: 0 })).toBe(
      "region.tier.declining",
    );
  });

  it("derives a signed mood delta from prosperity", () => {
    expect(regionMoodDelta({ id: "x", prosperity: 90, population: 0, stability: 0, development: 0 })).toBeGreaterThan(0);
    expect(regionMoodDelta({ id: "x", prosperity: 10, population: 0, stability: 0, development: 0 })).toBeLessThan(0);
  });

  it("finds the most prosperous region", () => {
    const s = emptyRegions([{ id: "a" }, { id: "b" }], "a");
    s.regions.b.prosperity = 95;
    expect(bestRegion(s)?.id).toBe("b");
  });
});
