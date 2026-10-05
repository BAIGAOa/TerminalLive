import { RandomSource } from "./RandomSource.js";

/**
 * Soft cap / floor for a candidate's effective weight.
 *
 * Weight products (`base * fate * bias * weather * …`) can explode or collapse
 * to zero, which either biases a roll absurdly or silently deletes an event
 * forever. We keep every *surviving* candidate inside this band so nothing is
 * permanently unreachable — a "minimum visible probability".
 */
export const MIN_VISIBLE_WEIGHT = 1e-4;
export const MAX_VISIBLE_WEIGHT = 1e6;
export const LOG_MIN_WEIGHT = Math.log(MIN_VISIBLE_WEIGHT);
export const LOG_MAX_WEIGHT = Math.log(MAX_VISIBLE_WEIGHT);

export interface WeightedEntry<T> {
  item: T;
  /** Effective (linear) weight after clamping; 0 when hard-excluded. */
  weight: number;
  /** Effective log-weight; `-Infinity` marks a hard exclusion. */
  logWeight: number;
}

/**
 * Sum of the logs of each factor. Any factor `<= 0` (a hard gate, a zeroed
 * cooldown) collapses the whole candidate to `-Infinity`, i.e. excluded.
 * Works in log space so a long chain of multiplications cannot overflow.
 */
export function logFactors(...factors: number[]): number {
  let sum = 0;
  for (const f of factors) {
    if (f <= 0 || !Number.isFinite(f)) return -Infinity;
    sum += Math.log(f);
  }
  return sum;
}

/** Clamp a finite log-weight into the visible band; pass `-Infinity` through. */
export function clampLogWeight(logWeight: number): number {
  if (logWeight === -Infinity) return logWeight; // hard exclusion
  // +Infinity / NaN still get clamped (and NaN is caught by buildWeighted) —
  // only a true -Infinity means "excluded".
  return Math.max(LOG_MIN_WEIGHT, Math.min(LOG_MAX_WEIGHT, logWeight));
}

/**
 * Evaluate every candidate exactly once and return the survivors.
 * Hard-excluded candidates (`logWeight === -Infinity`) are dropped.
 */
export function buildWeighted<T>(
  items: readonly T[],
  logWeightOf: (item: T) => number,
): WeightedEntry<T>[] {
  const out: WeightedEntry<T>[] = [];
  for (const item of items) {
    const logWeight = clampLogWeight(logWeightOf(item));
    if (!Number.isFinite(logWeight)) continue;
    out.push({ item, weight: Math.exp(logWeight), logWeight });
  }
  return out;
}

/**
 * Pick an index from `entries` using a numerically stable softmax
 * (subtract the max log-weight before exponentiating). Returns the index into
 * `entries`, or `-1` when there is nothing to pick.
 */
export function pickWeighted<T>(
  rng: RandomSource,
  entries: readonly WeightedEntry<T>[],
): number {
  if (entries.length === 0) return -1;

  let maxLog = -Infinity;
  for (const e of entries) if (e.logWeight > maxLog) maxLog = e.logWeight;

  const exps = new Array<number>(entries.length);
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    const v = Math.exp(entries[i].logWeight - maxLog);
    exps[i] = v;
    total += v;
  }
  if (total <= 0) return -1;

  let r = rng.next() * total;
  for (let i = 0; i < exps.length; i++) {
    if (r < exps[i]) return i;
    r -= exps[i];
  }
  return exps.length - 1;
}

/** Effective weight of `entries[i]` as a 0..1 fraction (for logs / debug). */
export function probabilityOf<T>(
  entries: readonly WeightedEntry<T>[],
  index: number,
): number {
  let maxLog = -Infinity;
  for (const e of entries) if (e.logWeight > maxLog) maxLog = e.logWeight;
  let total = 0;
  for (const e of entries) total += Math.exp(e.logWeight - maxLog);
  if (total <= 0 || index < 0 || index >= entries.length) return 0;
  return Math.exp(entries[index].logWeight - maxLog) / total;
}
