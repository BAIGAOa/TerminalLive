import z from "zod";
import { Requirement, StatDelta } from "./stats.js";
import { KarmaDelta } from "./chronicle/karma.js";
import {
  buffRefSchema,
  factionDeltaSchema,
  karmaDeltaSchema,
  relationshipDeltaSchema,
  requirementSchema,
  statDeltaSchema,
} from "./schema.js";

export interface ChoicePostEvent {
  incident: string;
  delay?: number;
  weight?: number;
}

/** A single branch the player can pick when an event offers a choice. */
export interface ChoiceDef {
  id: string;
  labelKey: string;
  /** Gate; when unmet the option is hidden (or disabled if `hidden` is false). */
  require?: Requirement[];
  /** When true and the gate fails, the option is omitted entirely. */
  hidden?: boolean;
  effects?: StatDelta;
  items?: string[];
  removeItems?: string[];
  relationship?: { npc: string; delta: number };
  buff?: { id: string; turns?: number };
  /** Karma this choice adds to the ledger. */
  karma?: KarmaDelta;
  /** Faction standing this choice shifts. */
  faction?: { id: string; delta: number };
  postEvent?: string | ChoicePostEvent[];
  flag?: string;
  /** Key for the outcome text shown/echoed after choosing. */
  noteKey?: string;
}

export const choiceSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  require: z.array(requirementSchema).default([]),
  hidden: z.boolean().default(false),
  effects: statDeltaSchema.optional(),
  items: z.array(z.string()).default([]),
  removeItems: z.array(z.string()).default([]),
  relationship: relationshipDeltaSchema.optional(),
  buff: buffRefSchema.optional(),
  karma: karmaDeltaSchema.optional(),
  faction: factionDeltaSchema.optional(),
  postEvent: z
    .union([
      z.string(),
      z.array(
        z.object({
          incident: z.string(),
          delay: z.number().optional(),
          weight: z.number().optional(),
        }),
      ),
    ])
    .optional(),
  flag: z.string().optional(),
  noteKey: z.string().optional(),
});

export type ChoiceJson = z.infer<typeof choiceSchema>;
