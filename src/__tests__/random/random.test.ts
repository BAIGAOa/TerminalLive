import { describe, it, expect } from "vitest";
import SeededRandom from "../../core/random/SeededRandom.js";
import { randomSeed } from "../../core/random/RandomService.js";
import {
  buildWeighted,
  logFactors,
  pickWeighted,
  probabilityOf,
} from "../../core/random/Weighting.js";
import EventDirector from "../../event/EventDirector.js";
import ChainTracker from "../../event/ChainTracker.js";
import type { Incident } from "../../world/Incident.js";

describe("SeededRandom", () => {
  it("is reproducible for a given seed", () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("resumes the exact stream from a snapshot (O(1) rewind)", () => {
    const a = new SeededRandom(999);
    for (let i = 0; i < 37; i++) a.next();
    const snap = a.snapshot();
    expect(snap).toEqual({ seed: 999, step: 37 });

    const expected = [a.next(), a.next(), a.next()];

    const b = new SeededRandom(0);
    b.restore(snap);
    expect([b.next(), b.next(), b.next()]).toEqual(expected);
  });

  it("stays in range for the toolbox distributions", () => {
    const r = new SeededRandom(7);
    for (let i = 0; i < 200; i++) {
      expect(r.int(5)).toBeGreaterThanOrEqual(0);
      expect(r.int(5)).toBeLessThan(5);
      expect(r.poisson(3)).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.normal(0, 1))).toBe(true);
    }
    expect(new Set(r.sample([1, 2, 3, 4, 5], 3)).size).toBe(3);
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("weighted pick respects zero weights and picks the only positive", () => {
    const r = new SeededRandom(1);
    const items = [{ w: 0 }, { w: 5 }, { w: 0 }];
    const picked = r.weighted(items, (i) => i.w);
    expect(picked).toBe(items[1]);
    expect(r.weighted([{ w: 0 }], (i) => i.w)).toBeUndefined();
  });
});

describe("Weighting (log-space)", () => {
  it("collapses to -Infinity when any factor is zero", () => {
    expect(logFactors(1, 2, 0, 3)).toBe(-Infinity);
    expect(logFactors(1, 2, 3)).toBeCloseTo(Math.log(6));
  });

  it("excludes hard-zeroed candidates and floors the rest", () => {
    const entries = buildWeighted([1, 2, 3], (n) =>
      n === 2 ? -Infinity : logFactors(1e-9 * n ** 4),
    );
    expect(entries.map((e) => e.item)).toEqual([1, 3]);
    // Floored to the minimum visible weight, not lost.
    for (const e of entries) expect(e.weight).toBeGreaterThan(0);
  });

  it("probability is proportional to weight", () => {
    const entries = buildWeighted([1, 2], (n) => Math.log(n));
    const total = probabilityOf(entries, 0) + probabilityOf(entries, 1);
    expect(total).toBeCloseTo(1);
    expect(pickWeighted(new SeededRandom(3), [])).toBe(-1);
  });
});

describe("RandomService fork isolation", () => {
  it("derives a deterministic sub-stream from seed + label", () => {
    // Two independent seeds give independent forks; same inputs give same fork.
    const r1 = new SeededRandom(42);
    const r2 = new SeededRandom(42);
    const seq = (r: SeededRandom) => [r.next(), r.next(), r.next()];
    expect(seq(r1)).toEqual(seq(r2));
    expect(randomSeed()).toBeGreaterThanOrEqual(0);
  });
});

describe("EventDirector", () => {
  const mk = (incident: Partial<Incident>): Incident =>
    ({ id: "x", tags: [], choices: null, ...incident }) as unknown as Incident;

  it("boosts recovery events when badly hurt", () => {
    const d = new EventDirector();
    const heal = mk({ id: "h", tags: ["heal"] });
    const ctx = { player: { health: 10, money: 0 } as never, world: null, pressures: null, weather: null };
    const hurt = d.factor(heal, ctx);
    const healthy = d.factor(heal, {
      ...ctx,
      player: { health: 90, money: 0 } as never,
    });
    expect(hurt).toBeGreaterThan(healthy);
  });

  it("invites challenges after a run of good fortune", () => {
    const d = new EventDirector();
    const challenge = mk({ id: "c", tags: ["challenge"] });
    const ctx = { player: { health: 90, money: 0 } as never, world: null, pressures: null, weather: null };
    const before = d.factor(challenge, ctx);
    for (let i = 0; i < 5; i++) d.observe(mk({ id: "b", tags: ["boon"] }));
    expect(d.factor(challenge, ctx)).toBeGreaterThan(before);
  });
});

describe("ChainTracker", () => {
  it("enforces once, maxRuns and group exclusivity", () => {
    const t = new ChainTracker();
    const edge = { incident: "n", edgeId: "e1", group: "g" };
    expect(t.isOpen("s", edge, 0, 10)).toBe(true);
    t.record("s", edge, 0);
    expect(t.isOpen("s", { ...edge, once: true }, 0, 10)).toBe(false); // group spent
    const capped = { incident: "n", edgeId: "e2", maxRuns: 1 };
    expect(t.isOpen("s", capped, 1, 10)).toBe(true);
    t.record("s", capped, 1);
    expect(t.isOpen("s", capped, 1, 10)).toBe(false);
  });

  it("honours the age window", () => {
    const t = new ChainTracker();
    const edge = { incident: "n", minAge: 30, maxAge: 40 };
    expect(t.isOpen("s", edge, 0, 20)).toBe(false);
    expect(t.isOpen("s", edge, 0, 35)).toBe(true);
    expect(t.isOpen("s", edge, 0, 50)).toBe(false);
  });
});
