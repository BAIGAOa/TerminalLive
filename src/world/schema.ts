import z from "zod";
import { StatKey } from "./stats.js";

export const STAT_KEY_VALUES = [
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
] as const;

export const statKeySchema = z.enum(STAT_KEY_VALUES) as unknown as z.ZodType<StatKey>;

export const statDeltaSchema = z.partialRecord(statKeySchema, z.number());

export const requirementSchema = z.object({
  prop: statKeySchema.optional(),
  npc: z.string().optional(),
  gte: z.number().optional(),
  lte: z.number().optional(),
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
