import z from "zod";
import { Requirement } from "../stats.js";
import { requirementSchema } from "../schema.js";

/** One rung of a career ladder. */
export interface CareerRank {
  titleKey: string;
  /** Money earned each year while at this rank. */
  salary: number;
  /** Gates for promotion INTO this rank. */
  requires: Requirement[];
}

export interface CareerDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  /** Ranks in ascending order; index 0 is the entry position. */
  ranks: CareerRank[];
}

export const careerSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  ranks: z
    .array(
      z.object({
        titleKey: z.string(),
        salary: z.number().default(0),
        requires: z.array(requirementSchema).default([]),
      }),
    )
    .min(1),
});

export type CareerJson = z.infer<typeof careerSchema>;
