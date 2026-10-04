import z from "zod";

/**
 * Cross-life persistence: the record of each finished life, kept as a bounded
 * family line in `resource/lineage.json`. Separate from the save schema (its
 * own `version`), so save-format churn never touches it.
 */
export const LINEAGE_FILE_VERSION = 1;
export const LINEAGE_HISTORY_CAP = 12;

const LineageStatsSchema = z.object({
  intelligence: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  fitness: z.number().min(0).max(100),
  happiness: z.number().min(0).max(100),
  reputation: z.number().min(0).max(100),
  health: z.number().min(0).max(100),
  money: z.number().min(0),
});

const LineageRecordSchema = z.object({
  /** Ordinal of the life that ended (1 = founder). */
  generation: z.number().int().min(1),
  name: z.string(),
  age: z.number().min(0),
  reason: z.enum(["death", "complete"]),
  score: z.number(),
  rankKey: z.string(),
  achievements: z.number().int().min(0),
  endedAt: z.string(),
  /** alignmentKey(karma): "karma.wisdom.pos" | "karma.neutral" | ... */
  epithetKey: z.string(),
  karma: z.record(z.string(), z.number()).default({}),
  stats: LineageStatsSchema,
});

export const LineageSchema = z.object({
  version: z.number().default(LINEAGE_FILE_VERSION),
  /** Oldest→newest; the last entry is the ancestor the next life inherits from. */
  history: z.array(LineageRecordSchema).max(LINEAGE_HISTORY_CAP).default([]),
});

export type LineageStats = z.infer<typeof LineageStatsSchema>;
export type LineageRecord = z.infer<typeof LineageRecordSchema>;
export type LineageState = z.infer<typeof LineageSchema>;

export const DEFAULT_LINEAGE_STATE: LineageState = {
  version: LINEAGE_FILE_VERSION,
  history: [],
};

export default LineageSchema;
