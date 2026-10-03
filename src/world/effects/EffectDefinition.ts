import z from "zod";
import { StatDelta } from "../stats.js";
import { statDeltaSchema } from "../schema.js";

export type EffectKind = "buff" | "debuff";

export interface EffectDefinition {
  id: string;
  labelKey: string;
  kind: EffectKind;
  /** Applied every year while the effect is active. */
  perTurn?: StatDelta;
  /** Default duration in years. */
  turns: number;
  maxStacks?: number;
  icon?: string;
  color?: string;
  descriptionKey?: string;
}

export const effectSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  kind: z.enum(["buff", "debuff"]).default("debuff"),
  perTurn: statDeltaSchema.optional(),
  turns: z.number().min(1).default(3),
  maxStacks: z.number().min(1).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  descriptionKey: z.string().optional(),
});

export type EffectJson = z.infer<typeof effectSchema>;
