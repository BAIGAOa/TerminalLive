import Player from "../Player.js";
import { StatDelta } from "../stats.js";
import {
  alignmentKey,
  dominantAxis,
  emptyKarma,
  KARMA_AXES,
  KarmaDelta,
  KarmaState,
} from "../chronicle/karma.js";
import { computeLifeScore } from "../../game/score.js";
import { LineageRecord } from "../../types/LineageType.js";

/** Snapshot a finished life. Reuses the score/rank and karma epithet helpers. */
export function buildLineageRecord(input: {
  player: Player;
  karma: KarmaState;
  reason: "death" | "complete";
  achievements: number;
  generation: number;
}): LineageRecord {
  const { player, karma, reason, achievements, generation } = input;
  const { score, rankKey } = computeLifeScore(player, achievements);
  return {
    generation,
    name: player.playerName,
    age: Math.floor(player.age),
    reason,
    score,
    rankKey,
    achievements,
    endedAt: new Date().toISOString(),
    epithetKey: alignmentKey(karma),
    karma: { ...karma },
    stats: {
      intelligence: player.intelligence,
      social: player.social,
      fitness: player.fitness,
      happiness: player.happiness,
      reputation: player.reputation,
      health: player.health,
      money: player.money,
    },
  };
}

export interface InheritancePlan {
  /** Ordinal of the new life. */
  generation: number;
  ancestorName: string;
  epithetKey: string;
  money: number;
  deltas: StatDelta;
  karmaLean: KarmaDelta | null;
  flag: string;
}

const APTITUDE_KEYS = ["intelligence", "social", "fitness"] as const;
const MONEY_CAP = 2000;
const ATTRIBUTE_CAP = 5;
const REPUTATION_CAP = 10;
const KARMA_LEAN_CAP = 10;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * What the next generation inherits from a finished life. Bounded so bonuses
 * cannot compound geometrically: a mediocre life grants nothing, and every
 * channel has a hard cap well below a single trait's worth.
 *
 * Returns `null` when there is no ancestor — a first life inherits nothing.
 */
export function computeInheritance(
  ancestor: LineageRecord | null,
): InheritancePlan | null {
  if (!ancestor) return null;

  const money = Math.min(Math.floor(ancestor.stats.money * 0.25), MONEY_CAP);

  const deltas: StatDelta = {};
  for (const key of APTITUDE_KEYS) {
    const bonus = clamp(Math.floor((ancestor.stats[key] - 40) / 10), 0, ATTRIBUTE_CAP);
    if (bonus > 0) deltas[key] = bonus;
  }
  const reputation = Math.min(Math.floor(ancestor.stats.reputation * 0.1), REPUTATION_CAP);
  if (reputation > 0) deltas.reputation = reputation;

  // Stored karma may be sparse (older/default records) — fill missing axes.
  const karma = emptyKarma();
  for (const axis of KARMA_AXES) {
    const v = ancestor.karma[axis];
    if (typeof v === "number") karma[axis] = v;
  }
  const { axis, value } = dominantAxis(karma);
  const lean = clamp(Math.round(value / 10), -KARMA_LEAN_CAP, KARMA_LEAN_CAP);
  const karmaLean: KarmaDelta | null = lean === 0 ? null : { [axis]: lean };

  return {
    generation: ancestor.generation + 1,
    ancestorName: ancestor.name,
    epithetKey: ancestor.epithetKey,
    money,
    deltas,
    karmaLean,
    flag: "lineage_heir",
  };
}
