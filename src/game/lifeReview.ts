import { alignmentKey, karmaScore, KarmaState } from "../world/chronicle/karma.js";

/**
 * Pure life-review builder: turns a finished life's numbers into a
 * multi-dimensional ending (career / family / health / reputation / karma /
 * world), an overall grade, an epithet, and a set of i18n lines a UI can render
 * as a short biography. No container, no React.
 */

export interface LifeReviewInput {
  name: string;
  age: number;
  reason: "death" | "complete";
  stats: {
    intelligence: number;
    social: number;
    fitness: number;
    happiness: number;
    health: number;
    reputation: number;
    money: number;
  };
  karma: Record<string, number>;
  careerRank: number;
  hasCareer: boolean;
  maxRelationship: number;
  relationshipsCount: number;
  /** 0..100 from the health engine. */
  wellbeing: number;
  lifeExpectancy: number;
  netWorth: number;
  regionProsperity: number;
  publicOrder: number;
  arcs: Array<{ id: string; stage: number; total: number }>;
  achievements: number;
  generation: number;
  score: number;
  rankKey: string;
}

export interface ReviewLine {
  key: string;
  params?: Record<string, string | number>;
}

export interface LifeReview {
  dimensions: {
    career: number;
    family: number;
    health: number;
    reputation: number;
    karma: number;
    world: number;
  };
  overall: number;
  gradeKey: string;
  epithetKey: string;
  lines: ReviewLine[];
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.round(Math.max(lo, Math.min(hi, v)));
}

export function buildLifeReview(input: LifeReviewInput): LifeReview {
  const career = clamp(
    input.careerRank * 20 +
      (input.hasCareer ? 15 : 0) +
      Math.min(input.stats.money / 100, 40),
  );
  const family = clamp(
    input.maxRelationship * 0.8 + input.relationshipsCount * 4,
  );
  const health = clamp(input.wellbeing * 0.6 + input.stats.health * 0.4);
  const reputation = clamp(
    input.stats.reputation + input.achievements * 3,
  );
  const karma = clamp(50 + karmaScore(input.karma as KarmaState) / 4);
  const world = clamp((input.regionProsperity + input.publicOrder) / 2);
  const overall = clamp((career + family + health + reputation + karma + world) / 6);

  const gradeKey =
    overall >= 80
      ? "review.grade.s"
      : overall >= 65
        ? "review.grade.a"
        : overall >= 50
          ? "review.grade.b"
          : overall >= 35
            ? "review.grade.c"
            : "review.grade.d";

  const epithetKey = alignmentKey(input.karma as KarmaState);

  const completedArcs = input.arcs.filter((a) => a.stage >= a.total).length;
  const lines: ReviewLine[] = [
    { key: "review.line.summary", params: { name: input.name, age: input.age } },
    { key: "review.line.epithet", params: { epithet: epithetKey } },
    { key: "review.line.career", params: { rank: input.careerRank + 1 } },
    { key: "review.line.family", params: { n: Math.round(input.maxRelationship) } },
    {
      key: "review.line.vitals",
      params: { wellbeing: input.wellbeing, expectancy: input.lifeExpectancy },
    },
    {
      key: "review.line.arcs",
      params: { done: completedArcs, total: input.arcs.length },
    },
    { key: "review.line.legacy", params: { gen: input.generation } },
  ];

  return {
    dimensions: { career, family, health, reputation, karma, world },
    overall,
    gradeKey,
    epithetKey,
    lines,
  };
}
