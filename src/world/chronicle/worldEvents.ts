import z from "zod";
import { KarmaDelta } from "./karma.js";
import { karmaDeltaSchema } from "../schema.js";

/** A scripted event in the world's own chronology, fired when its year comes. */
export interface WorldEventDefinition {
  id: string;
  /** World year (≈ player age) at which it fires (once). */
  year: number;
  labelKey: string;
  bodyKey: string;
  karma?: KarmaDelta;
  /** Adjustments to the hidden-score axes. */
  pressures?: Record<string, number>;
  standing?: { faction: string; delta: number };
  flag?: string;
  /** A lore id this event unlocks. */
  lore?: string;
}

export const worldEventSchema = z.object({
  id: z.string(),
  year: z.number(),
  labelKey: z.string(),
  bodyKey: z.string(),
  karma: karmaDeltaSchema.optional(),
  pressures: z.record(z.string(), z.number()).optional(),
  standing: z.object({ faction: z.string(), delta: z.number() }).optional(),
  flag: z.string().optional(),
  lore: z.string().optional(),
});
