import z from "zod";
import { Requirement, StatDelta } from "../../world/stats.js";
import { KarmaDelta } from "../../world/chronicle/karma.js";
import {
  buffRefSchema,
  factionDeltaSchema,
  karmaDeltaSchema,
  relationshipDeltaSchema,
  requirementSchema,
  statDeltaSchema,
} from "../../world/schema.js";

/** What a player action does when performed in a turn. */
export interface ActionDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  icon?: string;
  /** Action points consumed. */
  apCost: number;
  minAge?: number;
  maxAge?: number;
  /** Stat gates; the action is disabled (greyed) when unmet. */
  requires?: Requirement[];
  /** Only performable once per life (tracked by a flag). */
  once?: boolean;
  effects?: StatDelta;
  /** Items granted by the action. */
  items?: string[];
  relationship?: { npc: string; delta: number };
  buff?: { id: string; turns?: number };
  /** Karma this action adds to the ledger. */
  karma?: KarmaDelta;
  /** Faction standing this action shifts. */
  faction?: { id: string; delta: number };
  flag?: string;
}

export const actionSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  icon: z.string().optional(),
  apCost: z.number().min(1).default(1),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  requires: z.array(requirementSchema).default([]),
  once: z.boolean().default(false),
  effects: statDeltaSchema.optional(),
  items: z.array(z.string()).default([]),
  relationship: relationshipDeltaSchema.optional(),
  buff: buffRefSchema.optional(),
  karma: karmaDeltaSchema.optional(),
  faction: factionDeltaSchema.optional(),
  flag: z.string().optional(),
});

export type ActionJson = z.infer<typeof actionSchema>;
