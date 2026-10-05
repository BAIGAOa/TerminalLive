import { describe, it, expect } from "vitest";
import WorldRuleEngine from "../../world/rules/WorldRuleEngine.js";
import type { WorldRuleDef } from "../../world/rules/WorldRule.js";

function engine(defs: WorldRuleDef[]): WorldRuleEngine {
  const e = new WorldRuleEngine();
  e.setActiveDefs(defs);
  return e;
}

const HOSTILE: WorldRuleDef = {
  id: "rule_hostile",
  labelKey: "worldrule.hostile",
  statDrift: { happiness: -0.6 },
  mortality: { hazardMul: 1.2 },
  eventWeight: [
    { match: { tag: "challenge" }, factor: 1.6 },
    { match: { tag: "boon" }, factor: 0.5 },
  ],
};

const PARANOID: WorldRuleDef = {
  id: "rule_paranoid",
  labelKey: "worldrule.paranoid",
  statDrift: { social: -0.4 },
  npcSchemeFrequency: [
    { match: { role: "npc.role.rival" }, factor: 2 },
    { match: { role: "npc.role.friend" }, factor: 0.3 },
  ],
};

const PARADISE: WorldRuleDef = {
  id: "rule_paradise",
  labelKey: "worldrule.paradise",
  statDrift: { happiness: 0.5 },
  onWorldStart: { money: 200 },
  weatherBias: { weather_clear: 1.5, weather_storm: 0.4 },
};

describe("WorldRuleEngine", () => {
  it("folds stat drift across active rules", () => {
    const e = engine([HOSTILE, PARADISE]);
    const drift = e.drift();
    expect(drift.happiness).toBeCloseTo(-0.1); // -0.6 + 0.5
  });

  it("multiplies matching event weights and ignores non-matches", () => {
    const e = engine([HOSTILE]);
    expect(e.eventFactor(new Set(["challenge"]), "ev_x", null)).toBeCloseTo(1.6);
    expect(e.eventFactor(new Set(["boon"]), "ev_y", null)).toBeCloseTo(0.5);
    expect(e.eventFactor(new Set(["neutral"]), "ev_z", null)).toBe(1);
  });

  it("scales NPC scheme frequency by role", () => {
    const e = engine([PARANOID]);
    expect(e.npcSchemeFactor("npc.role.rival", new Set())).toBe(2);
    expect(e.npcSchemeFactor("npc.role.friend", new Set())).toBe(0.3);
    expect(e.npcSchemeFactor("npc.role.family", new Set())).toBe(1);
  });

  it("multiplies mortality hazards and weather biases", () => {
    const e = engine([HOSTILE, PARADISE]);
    expect(e.mortalityHazardMul()).toBeCloseTo(1.2);
    const wm = e.weatherMultipliers();
    expect(wm.weather_clear).toBeCloseTo(1.5);
    expect(wm.weather_storm).toBeCloseTo(0.4);
  });

  it("builds a start patch (money / stat / pressureSeed / flags)", () => {
    const e = engine([
      { id: "r", labelKey: "r", onWorldStart: { money: 100, flags: ["x"], pressureSeed: { pr_plague: 70 } } },
      PARADISE,
    ]);
    const patch = e.startPatch();
    expect(patch.money).toBe(300); // 100 + 200
    expect(patch.flags).toContain("x");
    expect(patch.pressureSeed.pr_plague).toBe(70);
  });

  it("clears back to no rules", () => {
    const e = engine([HOSTILE]);
    e.clear();
    expect(e.drift()).toEqual({});
    expect(e.mortalityHazardMul()).toBe(1);
  });
});
