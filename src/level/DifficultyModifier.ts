import { StatDelta } from "../world/stats.js";

/**
 * A per-difficulty life-start modifier, so a difficulty is more than a label:
 * it shifts the starting state and tags the run. Keyed by a level's
 * `difficultyIdentification`.
 */
export interface DifficultyModifier {
  /** Additive starting-stat shift (health/happiness/money/…). */
  statAdd?: StatDelta;
  /** Multiplier on starting money (e.g. 0.6 = a poorer start). */
  moneyMul?: number;
  /** Trait-like flat bonuses that help on the harder tiers. */
  statBonus?: StatDelta;
  /** A flag written onto the player for content to gate on. */
  flag?: string;
}

export const DIFFICULTY_MODIFIERS: Record<string, DifficultyModifier> = {
  easy: {
    statBonus: { happiness: 5 },
    flag: "diff_easy",
  },
  normal: {
    flag: "diff_normal",
  },
  hard: {
    statAdd: { health: -8, happiness: -6 },
    moneyMul: 0.6,
    flag: "diff_hard",
  },
  expert: {
    statAdd: { health: -15, happiness: -12 },
    moneyMul: 0.35,
    statBonus: { intelligence: 3 },
    flag: "diff_expert",
  },
};

export function difficultyModifier(id: string): DifficultyModifier {
  return DIFFICULTY_MODIFIERS[id] ?? { flag: `diff_${id}` };
}
