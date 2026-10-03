/**
 * Shared stat vocabulary used by the player, effects, items, actions and
 * event choices. Centralising it keeps the numeric fields, their clamp ranges
 * and the requirement/delta shapes in one place.
 */

export type StatKey =
  | "age"
  | "health"
  | "height"
  | "weight"
  | "money"
  | "intelligence"
  | "social"
  | "fitness"
  | "happiness"
  | "reputation"
  | "angerValue"
  | "excitationValue"
  | "depressionValue"
  | "weakValue";

export const STAT_KEYS: StatKey[] = [
  "age",
  "health",
  "height",
  "weight",
  "money",
  "intelligence",
  "social",
  "fitness",
  "happiness",
  "reputation",
  "angerValue",
  "excitationValue",
  "depressionValue",
  "weakValue",
];

/** A partial, additive change to the player's stats. */
export type StatDelta = Partial<Record<StatKey, number>>;

/**
 * A gate on a single stat — all provided bounds must hold for it to pass.
 * Used by actions, choices and achievements.
 */
export interface Requirement {
  /** Gate on a numeric stat (omit when gating on a relationship). */
  prop?: StatKey;
  /** Gate on an NPC relationship affinity instead of a stat. */
  npc?: string;
  gte?: number;
  lte?: number;
}

/** Max value for 0–100 gauges (skills, mood, psychology, health). */
export const MAX_GAUGE = 100;

const GAUGES: StatKey[] = [
  "health",
  "intelligence",
  "social",
  "fitness",
  "happiness",
  "reputation",
  "angerValue",
  "excitationValue",
  "depressionValue",
  "weakValue",
];

const NON_NEGATIVE: StatKey[] = ["age", "height", "weight", "money"];

export function clampStat(key: StatKey, value: number): number {
  let v = value;
  if (GAUGES.includes(key)) v = Math.max(0, Math.min(MAX_GAUGE, v));
  else if (NON_NEGATIVE.includes(key)) v = Math.max(0, v);
  return v;
}

export function isGauge(key: StatKey): boolean {
  return GAUGES.includes(key);
}

/** Scale every entry of a delta by a factor (e.g. effect stacks). */
export function scaleDelta(delta: StatDelta, factor: number): StatDelta {
  const out: StatDelta = {};
  for (const [k, v] of Object.entries(delta)) {
    if (typeof v === "number") out[k as StatKey] = v * factor;
  }
  return out;
}

export function mergeDelta(a: StatDelta, b: StatDelta): StatDelta {
  const out: StatDelta = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const key = k as StatKey;
    out[key] = (out[key] ?? 0) + (v ?? 0);
  }
  return out;
}

export function deltaEntries(delta: StatDelta): Array<[StatKey, number]> {
  return Object.entries(delta).filter(
    (e): e is [StatKey, number] => typeof e[1] === "number" && e[1] !== 0,
  );
}

/** Human-readable suffix for a stat key, e.g. `money` → `$`. */
export function formatDelta(delta: StatDelta): string {
  return deltaEntries(delta)
    .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
    .join(", ");
}
