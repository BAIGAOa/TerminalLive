import z from "zod";

/**
 * One coupling edge in the pressure web: every turn `target` is nudged by
 * `(source - threshold) * factor`. `threshold` defaults to the source axis's
 * midpoint, so a source above its middle pushes the target up (for a positive
 * factor) and one below pulls it down.
 */
export interface PressureRule {
  id?: string;
  source: string;
  target: string;
  factor: number;
  /** Nudge pivot; defaults to the source axis's (min+max)/2. */
  threshold?: number;
}

export const pressureRuleSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  target: z.string(),
  factor: z.number(),
  threshold: z.number().optional(),
});

export type PressureRuleJson = z.infer<typeof pressureRuleSchema>;
