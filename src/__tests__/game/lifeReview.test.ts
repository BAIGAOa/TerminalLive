import { describe, it, expect } from "vitest";
import { buildLifeReview, LifeReviewInput } from "../../game/lifeReview.js";

function input(over: Partial<LifeReviewInput> = {}): LifeReviewInput {
  return {
    name: "Tester",
    age: 80,
    reason: "death",
    stats: {
      intelligence: 50,
      social: 50,
      fitness: 50,
      happiness: 50,
      health: 50,
      reputation: 20,
      money: 500,
    },
    karma: { benevolence: 0, ambition: 0, wisdom: 40, rebellion: 0 },
    careerRank: 2,
    hasCareer: true,
    maxRelationship: 70,
    relationshipsCount: 3,
    wellbeing: 60,
    lifeExpectancy: 78,
    netWorth: 4000,
    regionProsperity: 60,
    publicOrder: 70,
    arcs: [
      { id: "scholar", stage: 3, total: 3 },
      { id: "family", stage: 1, total: 3 },
    ],
    achievements: 4,
    generation: 2,
    score: 300,
    rankKey: "rank.a",
    ...over,
  };
}

describe("buildLifeReview", () => {
  it("keeps every dimension within 0..100 and averages the overall", () => {
    const r = buildLifeReview(input());
    for (const v of Object.values(r.dimensions)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    const avg =
      Object.values(r.dimensions).reduce((s, v) => s + v, 0) / 6;
    expect(Math.abs(r.overall - Math.round(avg))).toBeLessThanOrEqual(1);
  });

  it("grades scale with the overall", () => {
    const low = buildLifeReview(
      input({
        careerRank: 0,
        hasCareer: false,
        stats: { ...input().stats, money: 0, reputation: 0 },
        maxRelationship: 0,
        relationshipsCount: 0,
        wellbeing: 0,
        regionProsperity: 0,
        publicOrder: 0,
        karma: { benevolence: -60, ambition: -60, wisdom: -60, rebellion: -60 },
        achievements: 0,
      }),
    );
    const high = buildLifeReview(
      input({
        careerRank: 4,
        stats: { ...input().stats, money: 10000, reputation: 100 },
        maxRelationship: 100,
        relationshipsCount: 8,
        wellbeing: 100,
        regionProsperity: 100,
        publicOrder: 100,
        karma: { benevolence: 80, ambition: 80, wisdom: 80, rebellion: 80 },
        achievements: 20,
      }),
    );
    expect(low.overall).toBeLessThan(high.overall);
    expect(high.gradeKey).toBe("review.grade.s");
    expect(low.gradeKey).toBe("review.grade.d");
  });

  it("derives the epithet from karma", () => {
    const r = buildLifeReview(input({ karma: { benevolence: 0, ambition: 0, wisdom: 70, rebellion: 0 } }));
    expect(r.epithetKey).toBe("karma.wisdom.pos");
  });

  it("emits the biography lines with the expected keys", () => {
    const r = buildLifeReview(input());
    const keys = r.lines.map((l) => l.key);
    expect(keys).toContain("review.line.summary");
    expect(keys).toContain("review.line.epithet");
    expect(keys).toContain("review.line.arcs");
    const arcs = r.lines.find((l) => l.key === "review.line.arcs");
    expect(arcs?.params).toMatchObject({ done: 1, total: 2 });
  });
});
