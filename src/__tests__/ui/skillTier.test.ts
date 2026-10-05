import { describe, it, expect } from "vitest";
import { averageCoreSkills, skillTier } from "../../game/skillTier.js";

describe("averageCoreSkills", () => {
  it("averages intelligence, social and fitness", () => {
    expect(
      averageCoreSkills({ intelligence: 30, social: 60, fitness: 90 }),
    ).toBe(60);
    expect(averageCoreSkills({ intelligence: 0, social: 0, fitness: 1 })).toBe(
      1 / 3,
    );
  });
});

describe("skillTier", () => {
  it("maps averages to translation keys at the documented thresholds", () => {
    expect(skillTier(90)).toBe("skillTier.legend");
    expect(skillTier(89)).toBe("skillTier.expert");
    expect(skillTier(75)).toBe("skillTier.expert");
    expect(skillTier(74)).toBe("skillTier.adept");
    expect(skillTier(55)).toBe("skillTier.adept");
    expect(skillTier(54)).toBe("skillTier.learner");
    expect(skillTier(35)).toBe("skillTier.learner");
    expect(skillTier(34)).toBe("skillTier.novice");
    expect(skillTier(0)).toBe("skillTier.novice");
  });
});
