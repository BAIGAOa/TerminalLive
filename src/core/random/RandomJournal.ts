/** One candidate in a recorded draw: its id, effective weight and probability. */
export interface WeightedCandidateRecord {
  id: string;
  weight: number;
  probability: number;
}

/**
 * A recorded random draw — candidate pool, each candidate's effective weight,
 * and who won. `seed` + `step` pin the exact point in the stream, so any draw
 * can be replayed deterministically.
 */
export interface DrawRecord {
  seq: number;
  label: string;
  at: string;
  age: number | null;
  seed: number;
  step: number;
  candidates: WeightedCandidateRecord[];
  chosen: string | null;
  note?: string;
}

export type DrawRecordInput = Omit<DrawRecord, "seq" | "at">;

/**
 * A bounded in-memory log of random draws, for the `random-log` console command
 * and for answering "why did event X (not) fire this year?".
 */
export default class RandomJournal {
  private records: DrawRecord[] = [];
  private seq = 0;
  private readonly max: number;

  constructor(max = 60) {
    this.max = max;
  }

  public record(input: DrawRecordInput): DrawRecord {
    const entry: DrawRecord = {
      ...input,
      seq: ++this.seq,
      at: new Date().toISOString(),
    };
    this.records = [entry, ...this.records].slice(0, this.max);
    return entry;
  }

  /** Newest first. */
  public all(): readonly DrawRecord[] {
    return this.records;
  }

  public recent(count: number): readonly DrawRecord[] {
    return this.records.slice(0, Math.max(0, count));
  }

  public last(): DrawRecord | null {
    return this.records[0] ?? null;
  }

  public size(): number {
    return this.records.length;
  }

  public clear(): void {
    this.records = [];
  }
}
