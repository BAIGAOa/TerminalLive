import z from "zod";
import type { StatDelta } from "../stats.js";

/**
 * A world rule: declarative modifiers that give a world its character — a
 * hellish world weights challenge events and kills sooner; an idyllic one lifts
 * mood and softens death. Rules are pure data, registered in a registry and
 * selected per world via the manifest's `worldRules` ids.
 */

export interface EventMatch {
  tag?: string;
  category?: string;
  id?: string;
}

export interface WorldStartPatch {
  stat?: StatDelta;
  money?: number;
  flags?: string[];
  pressureSeed?: Record<string, number>;
}

export interface WorldEconomyBias {
  inflationBias?: number;
  marketBias?: number;
  wageMul?: number;
}

export interface WorldRuleDef {
  id: string;
  labelKey: string;
  tags?: string[];
  /** Applied once at the start of a life in this world. */
  onWorldStart?: WorldStartPatch;
  /** Flat per-year stat drift. */
  statDrift?: StatDelta;
  /** Multipliers on event weights whose tags/category/id match. */
  eventWeight?: Array<{ match: EventMatch; factor: number }>;
  /** Multipliers on how often an NPC archetype schemes. */
  npcSchemeFrequency?: Array<{ match: { role?: string; tag?: string }; factor: number }>;
  economy?: WorldEconomyBias;
  mortality?: { hazardMul?: number };
  /** Multipliers on each weather state's transition weight. */
  weatherBias?: Record<string, number>;
}

export const worldRuleSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  tags: z.array(z.string()).optional(),
  onWorldStart: z
    .object({
      stat: z.record(z.string(), z.number()).optional(),
      money: z.number().optional(),
      flags: z.array(z.string()).optional(),
      pressureSeed: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
  statDrift: z.record(z.string(), z.number()).optional(),
  eventWeight: z
    .array(
      z.object({
        match: z.object({
          tag: z.string().optional(),
          category: z.string().optional(),
          id: z.string().optional(),
        }),
        factor: z.number(),
      }),
    )
    .optional(),
  npcSchemeFrequency: z
    .array(
      z.object({
        match: z.object({ role: z.string().optional(), tag: z.string().optional() }),
        factor: z.number(),
      }),
    )
    .optional(),
  economy: z
    .object({
      inflationBias: z.number().optional(),
      marketBias: z.number().optional(),
      wageMul: z.number().optional(),
    })
    .optional(),
  mortality: z.object({ hazardMul: z.number().optional() }).optional(),
  weatherBias: z.record(z.string(), z.number()).optional(),
});

export type WorldRuleJson = z.infer<typeof worldRuleSchema>;
