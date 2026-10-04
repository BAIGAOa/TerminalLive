/**
 * The random number contract every gameplay system draws from.
 *
 * A `RandomSource` is deliberately small: the uniform core (`next`) plus the
 * handful of distributions the game actually needs (weighted pick, shuffle,
 * sample, normal, poisson). Injecting it — instead of calling `Math.random`
 * directly — is what makes a life seedable, replayable and loggable.
 */
export interface RandomSnapshot {
  /** The seed this stream was started from. */
  seed: number;
  /** How many draws have happened since that seed. */
  step: number;
}

export interface RandomSource {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform float in [min, maxExclusive). */
  range(min: number, maxExclusive: number): number;
  /** True with probability `p` (default 0.5). */
  bool(p?: number): boolean;
  /** Weighted pick over `items`; `undefined` when every weight is non-positive. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T | undefined;
  /** Weighted index into `weights`; `-1` when the total is non-positive. */
  weightedIndex(weights: readonly number[]): number;
  /** `count` distinct items, uniformly without replacement. */
  sample<T>(items: readonly T[], count: number): T[];
  /** A uniformly shuffled copy of `items` (the input is not mutated). */
  shuffle<T>(items: readonly T[]): T[];
  /** Normal (Gaussian) sample via Box–Muller. */
  normal(mean: number, stddev: number): number;
  /** Poisson sample (number of rare events in an interval). */
  poisson(lambda: number): number;
  /** Current seed + step, for saving / replaying this stream. */
  snapshot(): RandomSnapshot;
  /** Rewind the stream to a previously captured snapshot. */
  restore(snapshot: RandomSnapshot): void;
}

/** Anything that yields a uniform [0,1) — lets systems accept a plain `rand()`. */
export type Uniform = () => number;
