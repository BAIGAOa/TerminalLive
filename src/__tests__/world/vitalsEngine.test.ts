import { describe, it, expect } from "vitest";
import {
  BASE_COUPLINGS,
  BMI_HIGH,
  HEIGHT_MAX,
  HEIGHT_MIN,
  WEIGHT_MAX,
  WEIGHT_MIN,
  bmi,
  bodyText,
  driftBody,
  formatHeight,
  formatWeight,
  evaluateVitals,
  type VitalsContext,
} from "../../world/vitalsEngine.js";

/** A neutral adult: nothing is extreme, so only the rule under test fires. */
function ctx(over: Partial<VitalsContext> = {}): VitalsContext {
  return {
    age: 30,
    health: 80,
    height: 1.75,
    weight: 70,
    intelligence: 50,
    social: 50,
    fitness: 50,
    // 50 is the dead band between MOOD_FLOOR and MOOD_RELIEF, so a neutral
    // context does not accidentally trip the mood rules in unrelated tests.
    happiness: 50,
    reputation: 20,
    appearance: 50,
    angerValue: 10,
    excitationValue: 10,
    depressionValue: 10,
    weakValue: 10,
    money: 500,
    conditions: new Set<string>(),
    addictions: new Set<string>(),
    bonded: true,
    partnered: false,
    employed: true,
    ...over,
  };
}

/** Makes every probabilistic rule fire. */
const always = () => 0;

describe("driftBody", () => {
  it("grows a child", () => {
    const delta = driftBody(ctx({ age: 6, height: 1.2 }));
    expect(delta.height).toBeGreaterThan(0);
  });

  it("stops growing at eighteen", () => {
    expect(driftBody(ctx({ age: 18, height: 1.75 })).height).toBeUndefined();
    expect(driftBody(ctx({ age: 40, height: 1.75 })).height).toBeUndefined();
  });

  it("adds mass as a child grows, instead of leaving them starved", () => {
    // The bug this guards: growing taller at a constant weight drove the BMI
    // below the underweight line, and the body then lost health every single
    // year of childhood — which cost ~24 years of lifespan across 200 lives.
    const before = ctx({ age: 6, height: 1.2, weight: 27 });
    const delta = driftBody(before);
    const height = before.height + (delta.height ?? 0);
    const weight = before.weight + (delta.weight ?? 0);
    expect(delta.weight).toBeGreaterThan(0);
    expect(bmi(height, weight)).toBeGreaterThan(17);
  });

  it("never lets a child be judged underweight", () => {
    const outcome = evaluateVitals(ctx({ age: 8, height: 1.3, weight: 25 }), always);
    expect(outcome.fired).not.toContain("underweight");
  });

  it("puts weight on after 35, and a fit body less of it", () => {
    const unfit = driftBody(ctx({ age: 40, fitness: 0 })).weight ?? 0;
    const fit = driftBody(ctx({ age: 40, fitness: 100 })).weight ?? 0;
    expect(unfit).toBeGreaterThan(fit);
    // A perfectly fit body holds its weight: no change at all is the intent.
    expect(fit).toBe(0);
    expect(unfit).toBeGreaterThan(0);
  });

  it("takes a little back in old age", () => {
    const delta = driftBody(ctx({ age: 80 }));
    expect(delta.height).toBeLessThan(0);
    expect(delta.weight).toBeLessThan(0);
  });

  it("keeps the body inside its band from any starting point", () => {
    for (const weight of [0, 35, 200]) {
      for (const age of [0, 20, 50, 90]) {
        const c = ctx({ age, weight, height: 1.8 });
        const d = driftBody(c);
        const next = c.weight + (d.weight ?? 0);
        expect(next).toBeGreaterThanOrEqual(WEIGHT_MIN);
        expect(next).toBeLessThanOrEqual(WEIGHT_MAX);
      }
    }
    for (const height of [0, 1, 3]) {
      for (const age of [0, 10, 20, 90]) {
        const c = ctx({ age, height });
        const d = driftBody(c);
        const next = c.height + (d.height ?? 0);
        expect(next).toBeGreaterThanOrEqual(HEIGHT_MIN);
        expect(next).toBeLessThanOrEqual(HEIGHT_MAX);
      }
    }
  });
});

describe("how the body reads on screen", () => {
  it("rounds height to the centimetre, whatever the arithmetic left behind", () => {
    expect(formatHeight(1.8)).toBe("1.80");
    expect(formatHeight(1.8000000000000003)).toBe("1.80");
    expect(formatHeight(1.756)).toBe("1.76");
  });

  it("rounds weight to a tenth", () => {
    expect(formatWeight(70.10000000000001)).toBe("70.1");
    expect(formatWeight(45)).toBe("45.0");
  });

  it("has an answer for any attribute, because the editor walks a generic list", () => {
    expect(bodyText("age", 62)).toBe("62");
    expect(bodyText("height", 1.8000000000000003)).toBe("1.80");
    expect(bodyText("weight", 70.1400000001)).toBe("70.1");
    expect(bodyText("playerName", "Mike")).toBe("Mike");
    expect(bodyText("missing", undefined)).toBe("");
  });
});

describe("the mood pair", () => {
  it("accumulates despair in an unhappy year", () => {
    const outcome = evaluateVitals(ctx({ happiness: 30 }), always);
    expect(outcome.fired).toContain("misery_accumulates");
    expect(outcome.delta.depressionValue).toBe(2);
  });

  it("eases despair in a happy one", () => {
    const outcome = evaluateVitals(ctx({ happiness: 80 }), always);
    expect(outcome.fired).toContain("contentment_eases");
    expect(outcome.delta.depressionValue).toBe(-2);
  });

  it("does neither in the dead band between them", () => {
    const outcome = evaluateVitals(ctx({ happiness: 50 }), always);
    expect(outcome.fired).not.toContain("misery_accumulates");
    expect(outcome.fired).not.toContain("contentment_eases");
  });
});

describe("despair becomes an illness", () => {
  it("diagnoses clinical depression once despair is extreme", () => {
    const outcome = evaluateVitals(ctx({ depressionValue: 75 }), always);
    expect(outcome.acquire).toContain("cond_depression");
  });

  it("does not re-diagnose what the player already has", () => {
    const outcome = evaluateVitals(
      ctx({ depressionValue: 75, conditions: new Set(["cond_depression"]) }),
      always,
    );
    expect(outcome.acquire).not.toContain("cond_depression");
  });

  it("leaves a merely low mood alone", () => {
    expect(evaluateVitals(ctx({ depressionValue: 40 }), always).acquire).toEqual([]);
  });

  it("turns the same misery into a drink", () => {
    const outcome = evaluateVitals(
      ctx({ depressionValue: 60, happiness: 30 }),
      always,
    );
    expect(outcome.indulge).toContain("add_alcohol");
  });

  it("lets resilience turn it into asking for help instead", () => {
    const outcome = evaluateVitals(
      ctx({ depressionValue: 60, addictions: new Set(["add_alcohol"]) }),
      always,
    );
    expect(outcome.tend).toContain("add_alcohol");
  });

  it("respects the dice on the probabilistic rules", () => {
    const c = ctx({ angerValue: 80 });
    expect(evaluateVitals(c, always).acquire).toContain("cond_anxiety");
    expect(evaluateVitals(c, () => 0.99).acquire).not.toContain("cond_anxiety");
  });
});

describe("the body charges for its shape", () => {
  it("charges an overweight adult", () => {
    const heavy = { height: 1.7, weight: Math.ceil(BMI_HIGH * 1.7 * 1.7) + 5 };
    const outcome = evaluateVitals(ctx(heavy), always);
    expect(outcome.fired).toContain("overweight");
    expect(outcome.delta.health).toBeLessThan(0);
  });

  it("charges an underweight adult", () => {
    const outcome = evaluateVitals(ctx({ height: 1.7, weight: 40 }), always);
    expect(outcome.fired).toContain("underweight");
  });

  it("leaves a healthy build alone", () => {
    const outcome = evaluateVitals(ctx({ height: 1.75, weight: 70 }), always);
    expect(outcome.fired).not.toContain("overweight");
    expect(outcome.fired).not.toContain("underweight");
  });
});

describe("the table itself", () => {
  it("gives every rule an id and an explanation", () => {
    for (const rule of BASE_COUPLINGS) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(rule.note.length).toBeGreaterThan(10);
    }
  });

  it("has no duplicate ids", () => {
    const ids = BASE_COUPLINGS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("makes no claim about a neutral, healthy adult", () => {
    const outcome = evaluateVitals(ctx(), always);
    // Body drift still runs — metabolism, ageing — but none of the table's
    // claims about this person hold, which is what keeps the rules meaningful
    // rather than a flat tax on living.
    expect(outcome.fired).toEqual([]);
    expect(outcome.acquire).toEqual([]);
    expect(outcome.indulge).toEqual([]);
  });
});

describe("rules contributed by a plugin", () => {
  const modRule = {
    id: "mod:pious",
    note: "A mod's claim: the devout sleep better.",
    when: (c: VitalsContext) => c.age > 40,
    then: { happiness: 1 },
  };

  it("runs alongside the built-in table", () => {
    const outcome = evaluateVitals(ctx({ age: 50 }), always, [modRule]);
    expect(outcome.fired).toContain("mod:pious");
    expect(outcome.delta.happiness).toBe(1);
  });

  it("does nothing when its own condition does not hold", () => {
    const outcome = evaluateVitals(ctx({ age: 20 }), always, [modRule]);
    expect(outcome.fired).not.toContain("mod:pious");
  });

  it("cannot replace a built-in rule — only add to it", () => {
    // Same id as a real rule, with the opposite effect. Both run: the engine
    // appends plugin rules rather than letting them stand in for the game's.
    const impostor = {
      id: "misery_accumulates",
      note: "A mod trying to take over a built-in id.",
      when: () => true,
      then: { happiness: 99 },
    };
    const outcome = evaluateVitals(ctx({ happiness: 30 }), always, [impostor]);
    expect(outcome.delta.depressionValue).toBe(2);
    expect(outcome.delta.happiness).toBe(99);
  });

  it("leaves the base table untouched when no plugin contributes", () => {
    expect(evaluateVitals(ctx({ age: 50 }), always).fired).not.toContain("mod:pious");
  });
});
