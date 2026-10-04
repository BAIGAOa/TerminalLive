import { describe, it, expect } from "vitest";
import {
  acquireCondition,
  addTrauma,
  buildResilience,
  emptyHealthState,
  HealthStats,
  lifeExpectancy,
  tendAddiction,
  tickHealth,
  treatCondition,
  useAddiction,
  wellbeing,
} from "../../world/health/healthEngine.js";

const stats: HealthStats = { age: 40, fitness: 50, social: 50, happiness: 50 };
const fixed = (v: number) => () => v;

describe("conditions", () => {
  it("acquires and treats a condition", () => {
    const s = emptyHealthState();
    expect(acquireCondition(s, "cond_diabetes", 40, 30)).toBe(true);
    expect(acquireCondition(s, "cond_diabetes", 41)).toBe(false); // no dupes
    treatCondition(s, "cond_diabetes", 10);
    expect(s.conditions.cond_diabetes.severity).toBeLessThan(30);
    treatCondition(s, "cond_diabetes", 100);
    expect(s.conditions.cond_diabetes).toBeUndefined();
  });

  it("drains vitality from severe conditions", () => {
    const s = emptyHealthState();
    acquireCondition(s, "cond_diabetes", 40, 100);
    const { vitalityDrag } = tickHealth(s, stats, fixed(0.5));
    expect(vitalityDrag).toBeGreaterThan(0.5);
  });
});

describe("psychology", () => {
  it("heals trauma faster with resilience and social ties", () => {
    const s = emptyHealthState();
    addTrauma(s, 50);
    s.resilience = 80;
    tickHealth(s, { ...stats, social: 80 }, fixed(0.5));
    expect(s.trauma).toBeLessThan(50);
  });

  it("clamps trauma and resilience to 0..100", () => {
    const s = emptyHealthState();
    addTrauma(s, 999);
    buildResilience(s, 999);
    expect(s.trauma).toBe(100);
    expect(s.resilience).toBe(100);
  });

  it("meaning rises with social fulfilment and falls under trauma", () => {
    const s = emptyHealthState();
    s.meaning = 50;
    tickHealth(s, { ...stats, social: 90, happiness: 90 }, fixed(0.9));
    expect(s.meaning).toBeGreaterThan(50);

    const low = emptyHealthState();
    low.trauma = 80;
    low.meaning = 50;
    tickHealth(low, stats, fixed(0.9));
    expect(low.meaning).toBeLessThan(50);
  });
});

describe("addictions", () => {
  it("rises with use and recedes with help / time", () => {
    const s = emptyHealthState();
    useAddiction(s, "add_alcohol", 30);
    expect(s.addictions.add_alcohol.dependence).toBe(30);
    tendAddiction(s, "add_alcohol", 40);
    expect(s.addictions.add_alcohol).toBeUndefined();
  });

  it("recedes year over year", () => {
    const s = emptyHealthState();
    useAddiction(s, "add_smoke", 40);
    tickHealth(s, stats, fixed(0.9));
    expect(s.addictions.add_smoke.dependence).toBeLessThan(40);
  });
});

describe("lifespan", () => {
  it("drops with severe conditions and rises with fitness", () => {
    const base = lifeExpectancy(emptyHealthState(), stats);
    const sick = emptyHealthState();
    acquireCondition(sick, "cond_diabetes", 40, 100);
    expect(lifeExpectancy(sick, stats)).toBeLessThan(base);

    const fit = lifeExpectancy(emptyHealthState(), { ...stats, fitness: 90 });
    expect(fit).toBeGreaterThan(base);
  });

  it("never reports an absurd expectancy", () => {
    const s = emptyHealthState();
    addTrauma(s, 100);
    useAddiction(s, "add_alcohol", 100);
    expect(lifeExpectancy(s, stats)).toBeGreaterThanOrEqual(30);
  });
});

describe("wellbeing", () => {
  it("stays within 0..100", () => {
    const s = emptyHealthState();
    expect(wellbeing(s)).toBeGreaterThanOrEqual(0);
    expect(wellbeing(s)).toBeLessThanOrEqual(100);
    s.trauma = 100;
    expect(wellbeing(s)).toBeGreaterThanOrEqual(0);
  });
});
