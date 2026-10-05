import { randomInt } from "node:crypto";
import SeededRandom from "./SeededRandom.js";
import RandomJournal from "./RandomJournal.js";
import { RandomSnapshot, RandomSource, Uniform } from "./RandomSource.js";

/** A fresh, unpredictable seed (crypto-backed, with a time fallback). */
export function randomSeed(): number {
  try {
    return randomInt(0, 0x100000000) >>> 0;
  } catch {
    return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
  }
}

/** FNV-1a — used to derive independent sub-streams from a seed + label. */
function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DrawLogInput {
  label: string;
  age?: number | null;
  candidates: Array<{ id: string; weight: number }>;
  chosen: string | null;
  note?: string;
}

/**
 * The single random stream the live game draws from — a container singleton.
 *
 * Gameplay uses one unpredictable seed per life; tests and replays call
 * {@link reseed} with a fixed seed. Because the state is just `{ seed, step }`,
 * it rides along in the save file, so a reload continues the *same* sequence
 * instead of re-rolling.
 */
export default class RandomService implements RandomSource {
  private src: SeededRandom;
  /** Seed to use for the next `reset()` (set by the Monte-Carlo harness). */
  private pendingSeed: number | null = null;
  /** Increments per {@link fork} call to keep sub-streams independent. */
  private forkCounter = 0;
  public readonly journal = new RandomJournal();
  /** Toggle journaling (e.g. off in hot loops / tests). */
  public journaling = true;

  constructor(seed?: number) {
    this.src = new SeededRandom(seed ?? randomSeed());
  }

  public get seed(): number {
    return this.src.seed;
  }

  public get step(): number {
    return this.src.snapshot().step;
  }

  /** Start a fresh stream: a fixed seed for tests/replays, else unpredictable. */
  public reseed(seed?: number): void {
    this.src = new SeededRandom(seed ?? randomSeed());
  }

  /**
   * Pin the seed the next {@link reset} will use (or `null` to clear it).
   * Lets the Monte-Carlo harness replay a whole life from a known seed.
   */
  public setNextSeed(seed: number | null): void {
    this.pendingSeed = seed;
  }

  /** New life: fresh entropy (or the pinned seed), fresh journal. */
  public reset(): void {
    this.reseed(this.pendingSeed ?? undefined);
    this.pendingSeed = null;
    this.journal.clear();
  }

  public snapshot(): RandomSnapshot {
    return this.src.snapshot();
  }

  public restore(snapshot: RandomSnapshot): void {
    this.src.restore(snapshot);
    // Drop the previous life's draws so the post-reload journal reflects only
    // the restored stream.
    this.journal.clear();
  }

  /**
   * A deterministic sub-stream keyed by `label`, derived from the current
   * seed+step. Mods draw from a fork so their randomness is reproducible and
   * never perturbs the main sequence (which would desync replays).
   */
  public fork(label: string): RandomSource {
    // Mix in a call counter so two labels that happen to hash-collide at the
    // same stream position still get independent sub-streams.
    const derived =
      (hashString(label) ^
        Math.imul(this.seed, 2654435761) ^
        this.step ^
        Math.imul(this.forkCounter++, 0x9e3779b1)) >>>
      0;
    return new SeededRandom(derived);
  }

  /** A bound `rand()` for APIs (pressure/weather) that take a callback. */
  public readonly rand: Uniform = () => this.src.next();

  /** Record a draw in the journal, stamping the stream position. */
  public logDraw(input: DrawLogInput): void {
    if (!this.journaling) return;
    let total = 0;
    for (const c of input.candidates) total += Math.max(0, c.weight);
    this.journal.record({
      label: input.label,
      age: input.age ?? null,
      seed: this.seed,
      step: this.step,
      chosen: input.chosen,
      note: input.note,
      candidates: input.candidates.map((c) => ({
        id: c.id,
        weight: c.weight,
        probability: total > 0 ? Math.max(0, c.weight) / total : 0,
      })),
    });
  }

  // ── RandomSource delegation ────────────────────────────────────
  public next(): number {
    return this.src.next();
  }

  public int(maxExclusive: number): number {
    return this.src.int(maxExclusive);
  }

  public range(min: number, maxExclusive: number): number {
    return this.src.range(min, maxExclusive);
  }

  public bool(p = 0.5): boolean {
    return this.src.bool(p);
  }

  public weighted<T>(
    items: readonly T[],
    weightOf: (item: T) => number,
  ): T | undefined {
    return this.src.weighted(items, weightOf);
  }

  public weightedIndex(weights: readonly number[]): number {
    return this.src.weightedIndex(weights);
  }

  public sample<T>(items: readonly T[], count: number): T[] {
    return this.src.sample(items, count);
  }

  public shuffle<T>(items: readonly T[]): T[] {
    return this.src.shuffle(items);
  }

  public normal(mean: number, stddev: number): number {
    return this.src.normal(mean, stddev);
  }

  public poisson(lambda: number): number {
    return this.src.poisson(lambda);
  }
}
