import z from "zod";
import { STAT_KEYS, type StatKey } from "./stats.js";

/**
 * The stat vocabulary, taken from the one place that defines it.
 *
 * This used to be a second, hand-copied list of the same keys. Adding
 * `appearance` updated `stats.ts` and missed here — and because this schema is
 * what validates content JSON, the failure was silent and total: every career
 * in `resource/careers/careers.json` failed to parse, the whole file was
 * skipped, and all that came out was a line on stderr. Deriving the list makes
 * that drift impossible.
 */
export const STAT_KEY_VALUES: readonly StatKey[] = STAT_KEYS;

export const statKeySchema = z.enum(STAT_KEY_VALUES as [StatKey, ...StatKey[]]);

export const statDeltaSchema = z.partialRecord(statKeySchema, z.number());

export const requirementSchema = z
  .object({
    prop: statKeySchema.optional(),
    npc: z.string().optional(),
    gte: z.number().optional(),
    lte: z.number().optional(),
  })
  // Must target something: a bare `{ gte: 50 }` is a content bug, not a gate.
  .refine((r) => r.prop !== undefined || r.npc !== undefined, {
    message: "requirement must set either `prop` or `npc`",
  });

export const buffRefSchema = z.object({
  id: z.string(),
  turns: z.number().optional(),
});

export const relationshipDeltaSchema = z.object({
  npc: z.string(),
  delta: z.number(),
});

export const karmaAxisSchema = z.enum([
  "benevolence",
  "ambition",
  "wisdom",
  "rebellion",
]);

export const karmaDeltaSchema = z.partialRecord(karmaAxisSchema, z.number());

export const factionDeltaSchema = z.object({
  id: z.string(),
  delta: z.number(),
});
