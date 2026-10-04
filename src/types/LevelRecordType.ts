import z from "zod";

/** Meta-progression record for one level, kept across lives. */
export const LevelRecordSchema = z.object({
  completions: z.number().int().min(0).default(0),
  /** Ids of optional objectives ("medals") earned at least once. */
  medals: z.array(z.string()).default([]),
  bestScore: z.number().default(0),
  /** "death" | "complete" — how the last attempt on this level ended. */
  lastOutcome: z.string().nullable().default(null),
});

export const LevelRecordsSchema = z.object({
  version: z.number().default(1),
  levels: z.record(z.string(), LevelRecordSchema).default({}),
});

export type LevelRecord = z.infer<typeof LevelRecordSchema>;
export type LevelRecordsState = z.infer<typeof LevelRecordsSchema>;

export const DEFAULT_LEVEL_RECORDS: LevelRecordsState = { version: 1, levels: {} };

export default LevelRecordsSchema;
