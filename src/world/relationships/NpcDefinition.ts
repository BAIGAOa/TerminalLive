import z from "zod";
import {
  buffRefSchema,
  karmaDeltaSchema,
  requirementSchema,
  statDeltaSchema,
} from "../schema.js";
import { NpcInteractionDef } from "./NpcInteraction.js";
import { NpcAutonomyDef } from "./NpcAutonomy.js";

export interface NpcDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  /** e.g. family / friend / rival — drives the default affinity. */
  roleKey?: string;
  /** Affinity the player starts with (0–100). */
  initial?: number;
  /** Flavour temperament tag shown on the detail panel. */
  temperamentKey?: string;
  /** Lines sampled when the player talks to this NPC. */
  dialogueKeys?: string[];
  /** Overrides the role's default interaction set when present. */
  interactions?: NpcInteractionDef[];
  /** Overrides the role's default autonomy set when present. */
  autonomy?: NpcAutonomyDef[];
}

const interactionSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  icon: z.string().optional(),
  apCost: z.number().min(0).default(1),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  requires: z.array(requirementSchema).default([]),
  minAffinity: z.number().optional(),
  effects: statDeltaSchema.optional(),
  items: z.array(z.string()).default([]),
  affinity: z.number().default(0),
  buff: buffRefSchema.optional(),
  flag: z.string().optional(),
  karma: karmaDeltaSchema.optional(),
  resultKey: z.string(),
});

const offerOptionSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  effects: statDeltaSchema.optional(),
  items: z.array(z.string()).default([]),
  affinity: z.number().default(0),
  buff: buffRefSchema.optional(),
  flag: z.string().optional(),
  resultKey: z.string().optional(),
});

const autonomySchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  weight: z.number().default(1),
  minAffinity: z.number().optional(),
  maxAffinity: z.number().optional(),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  kind: z.enum(["passive", "offer"]).default("passive"),
  effects: statDeltaSchema.optional(),
  items: z.array(z.string()).default([]),
  affinity: z.number().default(0),
  buff: buffRefSchema.optional(),
  flag: z.string().optional(),
  resultKey: z.string().optional(),
  offerTextKey: z.string().optional(),
  options: z.array(offerOptionSchema).default([]),
});

export const npcSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  roleKey: z.string().optional(),
  initial: z.number().min(0).max(100).default(30),
  temperamentKey: z.string().optional(),
  dialogueKeys: z.array(z.string()).default([]),
  interactions: z.array(interactionSchema).optional(),
  autonomy: z.array(autonomySchema).optional(),
});

export type NpcJson = z.infer<typeof npcSchema>;
