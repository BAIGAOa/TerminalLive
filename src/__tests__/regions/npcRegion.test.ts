import { describe, it, expect } from "vitest";
import {
  BOOM_AT,
  BUST_AT,
  desperation,
  emigrationPressure,
  homeMoodDrift,
  homeWealthDrift,
  migrateMultiplier,
  opportunityPull,
  regionDisposition,
  returnMultiplier,
} from "../../world/regions/npcRegion.js";
import type { NpcRegion } from "../../world/regions/npcRegion.js";

function region(prosperity: number, stability = 50): NpcRegion {
  return { id: "r", prosperity, stability, population: 50 };
}

/**
 * The load-bearing property of this whole layer: with no region — or a region
 * that is merely getting by — every number must be exactly what it was before
 * regions existed. If this breaks, the NPC simulation changes for saves and
 * tests that have nothing to do with regions.
 */
describe("regions are inert when there is nothing to say", () => {
  it("returns the neutral value for an unknown region", () => {
    expect(regionDisposition(undefined)).toBe("calm");
    expect(emigrationPressure(undefined)).toBe(0);
    expect(opportunityPull(undefined)).toBe(0);
    expect(desperation(undefined)).toBe(0);
    expect(homeWealthDrift(undefined)).toBe(0);
    expect(homeMoodDrift(undefined)).toBe(0);
  });

  it("leaves an ordinary region at exactly the old rate", () => {
    const ordinary = region(50);
    expect(migrateMultiplier(ordinary)).toBe(1);
    expect(returnMultiplier(ordinary)).toBe(1);
  });
});

describe("regionDisposition", () => {
  it("calls a thriving region a boom and a failing one a bust", () => {
    expect(regionDisposition(region(BOOM_AT))).toBe("boom");
    expect(regionDisposition(region(100))).toBe("boom");
    expect(regionDisposition(region(BUST_AT))).toBe("bust");
    expect(regionDisposition(region(0))).toBe("bust");
  });

  it("calls everything between calm", () => {
    expect(regionDisposition(region(BOOM_AT - 1))).toBe("calm");
    expect(regionDisposition(region(BUST_AT + 1))).toBe("calm");
  });
});

describe("the pressures", () => {
  it("pushes people out of a failing region, never out of a sound one", () => {
    expect(emigrationPressure(region(0))).toBe(1);
    expect(emigrationPressure(region(20))).toBeGreaterThan(0);
    expect(emigrationPressure(region(50))).toBe(0);
    expect(emigrationPressure(region(90))).toBe(0);
  });

  it("pulls people toward a prosperous one, never a poor one", () => {
    expect(opportunityPull(region(90))).toBe(1);
    expect(opportunityPull(region(70))).toBeGreaterThan(0);
    expect(opportunityPull(region(50))).toBe(0);
    expect(opportunityPull(region(10))).toBe(0);
  });

  it("reads disorder, not poverty, as desperation", () => {
    expect(desperation(region(10, 0))).toBe(1);
    expect(desperation(region(10, 45))).toBe(0);
    // A poor but orderly region is not lawless.
    expect(desperation(region(5, 80))).toBe(0);
  });

  it("rises monotonically as a region gets worse", () => {
    let previous = -1;
    for (const p of [60, 50, 40, 30, 20, 10, 0]) {
      const value = emigrationPressure(region(p));
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("what a home region does to a person", () => {
  it("makes migration likelier from a failing region and no likelier from a sound one", () => {
    expect(migrateMultiplier(region(0))).toBeGreaterThan(migrateMultiplier(region(50)));
    expect(migrateMultiplier(region(80))).toBe(1);
  });

  it("makes returning likelier to a thriving region", () => {
    expect(returnMultiplier(region(95))).toBeGreaterThan(1);
    expect(returnMultiplier(region(20))).toBe(1);
  });

  it("drifts wealth with prosperity and mood with stability", () => {
    expect(homeWealthDrift(region(90))).toBeGreaterThan(0);
    expect(homeWealthDrift(region(10))).toBeLessThan(0);
    expect(homeMoodDrift(region(50, 90))).toBeGreaterThan(0);
    expect(homeMoodDrift(region(50, 10))).toBeLessThan(0);
  });
});
