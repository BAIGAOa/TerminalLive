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
  /**
   * Archetype-type selecting the NPC class (Mindustry-style). Optional: when
   * absent it is inferred from `roleKey` (see ROLE_TO_TYPE / NpcTypeRegistry).
   */
  type?: string;
  /** Free-form custom fields parsed by the type's class (see Npc.parseParams). */
  params?: Record<string, unknown>;
  /** e.g. family / friend / rival — drives the default affinity. */
  roleKey?: string;
  /** Affinity the player starts with (0–100). */
  initial?: number;
  /** Age at the start of a life; NPCs age each year (see NpcSimulation). */
  startAge?: number;
  /**
   * Player age at which the player comes to know this NPC (overrides the role
   * default). Below it the NPC is absent from the relationship UI and never runs
   * its autonomy — the fix for age-inappropriate NPC events in childhood.
   */
  knownFromAge?: number;
  /** Player age after which the NPC is no longer part of the player's life. */
  knownUntilAge?: number;
  /** NPC ids this one is kin to — seeds the social graph. */
  kinOf?: string[];
  /** NPC id this one is partnered with at the start of a life. */
  partnerOf?: string;
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

export const autonomySchema = z.object({
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
  // Optional: inferred from roleKey when absent (backward compatible).
  type: z.string().optional(),
  // Free-form; a type's class reads/validates its own custom fields.
  params: z.record(z.string(), z.unknown()).optional(),
  roleKey: z.string().optional(),
  initial: z.number().min(0).max(100).default(30),
  startAge: z.number().optional(),
  knownFromAge: z.number().optional(),
  knownUntilAge: z.number().optional(),
  kinOf: z.array(z.string()).optional(),
  partnerOf: z.string().optional(),
  temperamentKey: z.string().optional(),
  dialogueKeys: z.array(z.string()).default([]),
  interactions: z.array(interactionSchema).optional(),
  autonomy: z.array(autonomySchema).optional(),
});

export type NpcJson = z.infer<typeof npcSchema>;
