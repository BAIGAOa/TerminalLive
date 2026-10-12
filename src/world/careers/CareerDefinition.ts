import z from "zod";
import { Requirement, StatDelta } from "../stats.js";
import { requirementSchema, statDeltaSchema } from "../schema.js";

/**
 * What a job charges, on top of whether you qualify for it.
 *
 * All four are per-career, because that is what makes a profession feel
 * different from another: a surgeon's resignation costs a career's worth of
 * reputation and locks the field for years, while a clerk walks away for the
 * price of a week's pay.
 */
export interface CareerTerms {
  /** Action points one application costs. */
  applyAp: number;
  /** Years this job stays closed to you after a failed attempt. */
  applyCooldown: number;
  /** Stats charged when you resign. */
  resignCost: StatDelta;
  /** Years this job stays closed to you after you resign. */
  resignCooldown: number;
}

export const DEFAULT_TERMS: CareerTerms = {
  applyAp: 1,
  applyCooldown: 1,
  resignCost: {},
  resignCooldown: 0,
};

const termsSchema = z.object({
  applyAp: z.number().min(0).default(DEFAULT_TERMS.applyAp),
  applyCooldown: z.number().min(0).default(DEFAULT_TERMS.applyCooldown),
  resignCost: statDeltaSchema.default({}),
  resignCooldown: z.number().min(0).default(DEFAULT_TERMS.resignCooldown),
});

/** One rung of a career ladder. */
export interface CareerRank {
  titleKey: string;
  /** Money earned each year while at this rank. */
  salary: number;
  /** Gates for promotion INTO this rank. */
  requires: Requirement[];
}

/**
 * An extra rule a career carries on top of the shared ladder mechanics.
 *
 * These are the "special mechanics" that make one job play differently from
 * another; the yearly tick reads them (see `careerEngine.ts`).
 */
export type CareerMechanic =
  /** Pay tracks performance, not just the rank's flat salary. */
  | "commission"
  /** Reputation moves twice as fast — politics is the job. */
  | "public"
  /** Past rank 1 you need a certification to advance. */
  | "guild"
  /** The body pays for the work: health drains faster. */
  | "hazard";

export const CAREER_MECHANICS: CareerMechanic[] = [
  "commission",
  "public",
  "guild",
  "hazard",
];

export interface CareerDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  /** Emoji drawn on the board card. */
  icon: string;
  /** Broad field, used to group the board (i18n key). */
  fieldKey: string;
  /**
   * Gates for taking the job at all — age, appearance, stats. Distinct from a
   * rank's `requires`, which gate *promotion* once you are already in.
   */
  entry: Requirement[];
  /**
   * A life-long post. Once taken it can never be quit, and while it is held no
   * other career can be joined.
   */
  lifelong: boolean;
  mechanics: CareerMechanic[];
  /** What applying and resigning cost, per career. */
  terms: CareerTerms;
  /** Ranks in ascending order; index 0 is the entry position. */
  ranks: CareerRank[];
}

export const careerSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  icon: z.string().default("💼"),
  fieldKey: z.string().default("career.field.misc"),
  entry: z.array(requirementSchema).default([]),
  lifelong: z.boolean().default(false),
  mechanics: z.array(z.enum(["commission", "public", "guild", "hazard"])).default([]),
  terms: termsSchema.default({ ...DEFAULT_TERMS }),
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
