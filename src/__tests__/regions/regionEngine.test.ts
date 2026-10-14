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
  playerInfluence,
  prosperityTier,
  regionCharacter,
  regionMoodDelta,
  regionYearlyDelta,
  tickRegions,
  MAX_INFLUENCE,
  MIN_INFLUENCE,
} from "../../world/regions/regionEngine.js";
import type { RegionAdjacency, RegionsState } from "../../world/regions/regionEngine.js";

const fixed = (v: number) => () => v;
const adj = { a: ["b"], b: ["a", "c"], c: ["b"] };

/** A small deterministic LCG — `fixed` makes every probability fire at once. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** The shape every world actually uses: regions in a ring. */
function ring(n: number): { ids: string[]; adjacency: RegionAdjacency } {
  const ids = Array.from({ length: n }, (_, i) => `reg_${i}`);
  const adjacency: RegionAdjacency = {};
  ids.forEach((id, i) => {
    adjacency[id] = [ids[(i + n - 1) % n], ids[(i + 1) % n]];
  });
  return { ids, adjacency };
}

function world(n: number): RegionsState {
  const { ids } = ring(n);
  return emptyRegions(ids.map((id) => ({ id })), ids[0]);
}

function run(state: RegionsState, adjacency: RegionAdjacency, rng: () => number, years: number) {
  for (let y = 0; y < years; y++) tickRegions(state, adjacency, rng);
}

function pros(state: RegionsState): number[] {
  return Object.values(state.regions).map((r) => r.prosperity);
}

function spread(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

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

describe("region character", () => {
  it("is stable for a given id", () => {
    expect(regionCharacter("reg_3")).toEqual(regionCharacter("reg_3"));
  });

  it("gives the regions of one world different capacities", () => {
    const capacities = new Set(
      Array.from({ length: 7 }, (_, i) => regionCharacter(`reg_${i}`).carryingCapacity),
    );
    expect(capacities.size).toBeGreaterThan(3);
  });

  it("always puts the tipping point strictly below capacity", () => {
    for (let i = 0; i < 60; i++) {
      const c = regionCharacter(`probe_${i}`);
      expect(c.allee).toBeLessThan(c.carryingCapacity);
      expect(c.allee).toBeGreaterThan(0);
    }
  });

  it("lets a world override any field", () => {
    expect(regionCharacter("reg_0", { carryingCapacity: 95 }).carryingCapacity).toBe(95);
  });

  it("seeds the regions of a world apart, not identically", () => {
    const p = pros(world(7));
    expect(Math.max(...p) - Math.min(...p)).toBeGreaterThan(10);
  });
});

/**
 * The bug this whole model replaces, stated as a test.
 *
 * The old four lines of drift pinned the entire map at exactly 100.000 by year
 * 47 and flattened every region to the same value by year 63 — measured — so
 * nothing ever declined and `region.bust` was unreachable.
 */
describe("long-run dynamics", () => {
  it("neither saturates nor converges", () => {
    for (const seed of [11, 222, 3333]) {
      const { ids, adjacency } = ring(7);
      const s = emptyRegions(ids.map((id) => ({ id })), ids[0]);
      run(s, adjacency, lcg(seed), 100);
      const p = pros(s);

      expect(Math.max(...p)).toBeLessThan(100);
      expect(spread(p)).toBeGreaterThan(2);

      for (const v of p) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      for (const r of Object.values(s.regions)) {
        for (const v of [r.stability, r.population, r.development]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("replays identically from the same seed", () => {
    const { adjacency } = ring(7);
    const a = world(7);
    run(a, adjacency, lcg(99), 60);
    const b = world(7);
    run(b, adjacency, lcg(99), 60);
    expect(pros(a)).toEqual(pros(b));
  });
});

describe("the collapse trap", () => {
  /** `0.9` clears both the shock roll and the recovery roll, so neither fires. */
  const inert = () => 0.9;
  /** `0` is under both — shocks land and recovery always succeeds. */
  const eager = () => 0;

  it("falls when it is pushed under its tipping point", () => {
    const { ids, adjacency } = ring(7);
    const s = emptyRegions(ids.map((id) => ({ id })), ids[0]);
    s.regions[ids[0]].prosperity = 1; // far under every achievable allee (>= 12)
    s.regions[ids[0]].collapsed = false;

    const events = tickRegions(s, adjacency, inert);

    expect(s.regions[ids[0]].collapsed).toBe(true);
    expect(events.filter((e) => e.kind === "region.collapse")).toHaveLength(1);
  });

  it("stays down, and empties out", () => {
    const { ids, adjacency } = ring(7);
    const s = emptyRegions(ids.map((id) => ({ id })), ids[0]);
    const target = s.regions[ids[0]];
    target.collapsed = true;
    target.prosperity = 5;

    run(s, adjacency, inert, 30);

    expect(target.collapsed).toBe(true);
    expect(target.prosperity).toBeLessThan(5);
    // A ruin empties — which is the story the NPC layer will narrate.
    expect(target.population).toBeLessThan(30);
  });

  it("announces the fall once, not every year", () => {
    const { ids, adjacency } = ring(7);
    const s = emptyRegions(ids.map((id) => ({ id })), ids[0]);
    s.regions[ids[0]].prosperity = 1;
    s.regions[ids[0]].collapsed = false;
    tickRegions(s, adjacency, inert); // the fall itself

    const later: string[] = [];
    for (let y = 0; y < 20; y++) {
      later.push(...tickRegions(s, adjacency, inert).map((e) => e.kind));
    }
    expect(later).not.toContain("region.collapse");
  });

  it("lets a region climb back out", () => {
    const { ids, adjacency } = ring(7);
    const s = emptyRegions(ids.map((id) => ({ id })), ids[0]);
    s.regions[ids[0]].collapsed = true;
    s.regions[ids[0]].prosperity = 5;

    run(s, adjacency, eager, 40);
    expect(s.regions[ids[0]].collapsed).toBe(false);
  });

  it("can happen to a region that was doing fine", () => {
    // The whole point: a healthy region must be able to fall, or `region.bust`
    // is unreachable again. Run the real dynamics rather than a rigged state.
    let tipped = 0;
    for (const seed of [11, 222, 3333, 44444, 555555]) {
      const { ids, adjacency } = ring(7);
      const s = emptyRegions(ids.map((id) => ({ id })), ids[0]);
      const rng = lcg(seed);
      for (let y = 0; y < 150; y++) {
        for (const e of tickRegions(s, adjacency, rng)) {
          if (e.kind === "region.collapse") tipped++;
        }
      }
    }
    expect(tipped).toBeGreaterThan(0);
  });
});

describe("playerInfluence", () => {
  const nobody = { money: 0, reputation: 0, careerRank: 0, factionStanding: 0 };
  const titan = { money: 50_000_000, reputation: 100, careerRank: 4, factionStanding: 100 };

  it("never falls as a single input rises", () => {
    const wealth = [0, 100, 1_000, 10_000, 1_000_000];
    for (let i = 1; i < wealth.length; i++) {
      expect(playerInfluence({ ...nobody, money: wealth[i] })).toBeGreaterThanOrEqual(
        playerInfluence({ ...nobody, money: wealth[i - 1] }),
      );
    }
    for (let rank = 1; rank <= 4; rank++) {
      expect(playerInfluence({ ...nobody, careerRank: rank })).toBeGreaterThanOrEqual(
        playerInfluence({ ...nobody, careerRank: rank - 1 }),
      );
    }
  });

  it("is bounded however extreme the inputs", () => {
    expect(playerInfluence(titan)).toBe(MAX_INFLUENCE);
    expect(
      playerInfluence({ money: -1e9, reputation: -100, careerRank: 0, factionStanding: -100 }),
    ).toBe(MIN_INFLUENCE);
  });

  it("saturates wealth — the tenth million buys no more than the second", () => {
    const rest = { reputation: 100, careerRank: 4, factionStanding: 100 };
    expect(playerInfluence({ ...rest, money: 2_000_000 })).toBe(
      playerInfluence({ ...rest, money: 20_000_000 }),
    );
  });

  it("makes a nobody a drag and a titan a boon", () => {
    expect(playerInfluence(nobody)).toBeLessThan(0);
    expect(playerInfluence(titan)).toBeGreaterThan(0);
  });
});

describe("regionYearlyDelta", () => {
  const at = (prosperity: number, stability = 50) => ({
    id: "x",
    prosperity,
    population: 50,
    stability,
    development: 50,
  });

  it("lifts the residents of a thriving region and grinds down a ruined one", () => {
    expect(regionYearlyDelta(at(90, 90)).happiness).toBeGreaterThan(0);
    expect(regionYearlyDelta(at(10, 10)).happiness).toBeLessThan(0);
  });

  it("is neutral for an average region", () => {
    expect(regionYearlyDelta(at(50, 50))).toEqual({});
  });

  it("is a tone, not a yoke", () => {
    const d = regionYearlyDelta(at(100, 100));
    expect(Math.abs(d.happiness ?? 0)).toBeLessThanOrEqual(4);
    expect(Math.abs(d.health ?? 0)).toBeLessThanOrEqual(2);
  });

  it("says nothing about a region that does not exist", () => {
    expect(regionYearlyDelta(undefined)).toEqual({});
  });
});
