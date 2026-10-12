import { describe, it, expect } from "vitest";
import {
  attemptRefusal,
  cooldownRemaining,
  cooldownUntil,
  resignation,
  startCooldown,
} from "../../world/careers/hiring.js";
import {
  DEFAULT_TERMS,
  type CareerDefinition,
} from "../../world/careers/CareerDefinition.js";
import { emptyWorkState } from "../../world/careers/careerEngine.js";

function career(terms: Partial<CareerDefinition["terms"]> = {}): CareerDefinition {
  return {
    id: "job",
    labelKey: "job",
    descKey: "job.desc",
    icon: "💼",
    fieldKey: "career.field.misc",
    entry: [],
    lifelong: false,
    mechanics: [],
    terms: { ...DEFAULT_TERMS, ...terms },
    ranks: [{ titleKey: "r0", salary: 10, requires: [] }],
  };
}

describe("cooldowns", () => {
  it("reports no gate for a career that was never tried", () => {
    const work = emptyWorkState();
    expect(cooldownUntil(work, "job")).toBeNull();
    expect(cooldownRemaining(work, "job", 30)).toBe(0);
  });

  it("counts whole years still to wait", () => {
    let work = startCooldown(emptyWorkState(), "job", 3, 30);
    expect(cooldownUntil(work, "job")).toBe(33);
    expect(cooldownRemaining(work, "job", 30)).toBe(3);
    expect(cooldownRemaining(work, "job", 32)).toBe(1);
    expect(cooldownRemaining(work, "job", 33)).toBe(0);
  });

  it("leaves the state untouched when there is nothing to wait for", () => {
    const work = emptyWorkState();
    expect(startCooldown(work, "job", 0, 30)).toBe(work);
  });

  it("does not disturb another career's cooldown", () => {
    let work = startCooldown(emptyWorkState(), "a", 2, 30);
    work = startCooldown(work, "b", 5, 30);
    expect(cooldownUntil(work, "a")).toBe(32);
    expect(cooldownUntil(work, "b")).toBe(35);
  });
});

describe("attemptRefusal", () => {
  it("allows an attempt when affordable and off cooldown", () => {
    expect(attemptRefusal(career(), emptyWorkState(), 2, 30)).toBeNull();
  });

  it("refuses, and says so, when the action points are short", () => {
    const refusal = attemptRefusal(career({ applyAp: 2 }), emptyWorkState(), 1, 30);
    expect(refusal).toMatchObject({ key: "career.err.ap", params: { n: 2 } });
  });

  it("refuses while the career is still cooling down", () => {
    const work = startCooldown(emptyWorkState(), "job", 4, 30);
    const refusal = attemptRefusal(career(), work, 9, 31);
    expect(refusal).toMatchObject({ key: "career.err.cooldown", params: { n: 3 } });
  });

  it("reports the cooldown before the cost — the nearer reason first", () => {
    const work = startCooldown(emptyWorkState(), "job", 2, 30);
    const refusal = attemptRefusal(career({ applyAp: 3 }), work, 0, 30);
    expect(refusal?.key).toBe("career.err.cooldown");
  });

  it("charges nothing for a career that costs no action points", () => {
    expect(attemptRefusal(career({ applyAp: 0 }), emptyWorkState(), 0, 30)).toBeNull();
  });
});

describe("resignation", () => {
  const terms = {
    resignCost: { money: -100, reputation: -10, happiness: 20 },
    resignCooldown: 2,
  };

  it("charges the career's own terms after a real tenure", () => {
    const out = resignation(career(terms), 5);
    expect(out.halfNotice).toBe(false);
    expect(out.cost).toEqual({ money: -100, reputation: -10, happiness: 20 });
    expect(out.cooldown).toBe(2);
  });

  it("doubles the penalty and halves the bonus for a first-year exit", () => {
    const out = resignation(career(terms), 0);
    expect(out.halfNotice).toBe(true);
    // Penalties grow, the happiness payoff shrinks.
    expect(out.cost).toEqual({ money: -200, reputation: -20, happiness: 10 });
    expect(out.cooldown).toBe(4);
  });

  it("costs nothing when the career charges nothing", () => {
    const out = resignation(career(), 0);
    expect(out.cost).toEqual({});
    expect(out.cooldown).toBe(0);
  });
});
