import { RandomSnapshot, RandomSource } from "./RandomSource.js";

/** The additive constant of the mulberry32 state update. */
const STEP = 0x6d2b79f5;

/**
 * A small, fast, seedable PRNG (mulberry32) with a rewindable state.
 *
 * The state update is purely additive (`state += STEP`), so the state after
 * `n` draws is `seed + n * STEP`. That makes {@link restore} O(1) instead of
 * re-playing `n` draws — the key trick that lets a save record just
 * `{ seed, step }` and resume the exact same stream.
 */
export default class SeededRandom implements RandomSource {
  private _seed: number;
  private state: number;
  private count: number;

  constructor(seed = 0) {
    this._seed = seed >>> 0;
    this.state = this._seed;
    this.count = 0;
  }

  public get seed(): number {
    return this._seed;
  }

  public next(): number {
    this.count++;
    this.state = (this.state + STEP) | 0;
    const a = this.state;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  public range(min: number, maxExclusive: number): number {
    return min + this.next() * (maxExclusive - min);
  }

  public bool(p = 0.5): boolean {
    return this.next() < p;
  }

  public weighted<T>(
    items: readonly T[],
    weightOf: (item: T) => number,
  ): T | undefined {
    // Weight each item once, then select in a single walk (never twice).
    let total = 0;
    const weights = new Array<number>(items.length);
    for (let i = 0; i < items.length; i++) {
      const w = Math.max(0, weightOf(items[i]));
      weights[i] = w;
      total += w;
    }
    const idx = this.pick(weights, total);
    return idx < 0 ? undefined : items[idx];
  }

  public weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    return this.pick(weights, total);
  }

  private pick(weights: readonly number[], total: number): number {
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i]);
      if (r < w) return i;
      r -= w;
    }
    return weights.length - 1;
  }

  public sample<T>(items: readonly T[], count: number): T[] {
    const k = Math.max(0, Math.min(count, items.length));
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < k; i++) {
      const j = i + this.int(pool.length - i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
      out.push(pool[i]);
    }
    return out;
  }

  public shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  public normal(mean: number, stddev: number): number {
    // Box–Muller, recomputing both uniforms each call so the state stays a
    // pure function of `step` (no cached spare, which would break rewind).
    let u = this.next();
    if (u <= 0) u = Number.EPSILON;
    const v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * stddev;
  }

  public poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    // Knuth's method for small λ; Gaussian approximation for large λ.
    if (lambda >= 30) {
      return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
    }
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > limit);
    return k - 1;
  }

  public snapshot(): RandomSnapshot {
    return { seed: this._seed, step: this.count };
  }

  public restore(snapshot: RandomSnapshot): void {
    // Guard against NaN/Infinity from a corrupt or hand-edited save: `Math.floor(NaN)`
    // is NaN, which would poison `count` and every later snapshot for this life.
    const step = Number.isFinite(snapshot.step)
      ? Math.max(0, Math.floor(snapshot.step))
      : 0;
    this._seed = Number.isFinite(snapshot.seed) ? snapshot.seed >>> 0 : 0;
    // state after `step` draws = seed + step * STEP (mod 2^32).
    this.state = (this._seed + Math.imul(step, STEP)) | 0;
    this.count = step;
  }
}
