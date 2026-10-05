import z from "zod";
import { statDeltaSchema, karmaDeltaSchema } from "../world/schema.js";

/** A `{ type, params }` condition entry (validated strongly by the loader). */
const conditionSpec = z.object({
  type: z.string(),
  // 先不限制参数：模组拥有极大的自由度，由 WorldManifestLoader 通过注册表的
  // schema 做强校验。
  params: z.record(z.string(), z.any()),
});

/**
 * `world.json` — a World's manifest. A World is one entire life lived inside a
 * self-contained setting that owns its own events, NPCs, chronicle, pressures,
 * weather and world rules.
 */
export const worldManifestSchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  descriptionKey: z.string(),
  /** Emoji shown on the selection card. */
  icon: z.string().default("🌍"),
  /** Theme chips for grouping in the selection screen (e.g. "harsh", "coastal"). */
  tags: z.array(z.string()).default([]),
  /** Difficulty label (badge; drives the difficulty registry grouping). */
  difficultyIdentification: z.string().default("easy"),

  /**
   * Bumped whenever a world's content changes incompatibly; stored in saves so
   * a resume refuses to apply mismatched content.
   */
  contentVersion: z.number().default(1),

  // ── world start state ──
  /** Player state applied at the start of a life in this world. */
  startPlayer: z.record(z.string(), z.unknown()).default({}),
  /** Legacy alias of `startPlayer` (still honoured when `startPlayer` is empty). */
  onEnter: z
    .object({ setPlayer: z.record(z.string(), z.unknown()).optional() })
    .optional(),
  /** Era the chronicle begins in (defaults to the first era). */
  startEra: z.string().optional(),
  /** Region the player is born into (defaults to a random region). */
  startRegion: z.string().optional(),
  /** Offset mapping player age → chronicle year (for non-birth-start worlds). */
  eraYearOffset: z.number().default(0),

  // ── content scoping ──
  /**
   * When true, the world's scoped content dirs REPLACE the global baseline for
   * that category (also clearing mod content of that category); when false
   * (default) they layer over the baseline, overriding by id where possible.
   * A world's `npcs/` dir always replaces the shared cast regardless.
   */
  selfContained: z.boolean().default(false),
  /** World-rule ids (see WorldRuleRegistry) applied for the whole life. */
  worldRules: z.array(z.string()).default([]),

  // ── engine config ──
  algorithm: z.string().default("default"),
  extraFilters: z.array(z.string()).default([]),

  // ── goals ──
  /** Objectives beyond the completion conditions; optional ones are medals. */
  objectives: z.array(z.object({
    id: z.string(),
    labelKey: z.string(),
    optional: z.boolean().default(false),
    condition: conditionSpec,
    reward: z.object({
      effects: statDeltaSchema.optional(),
      items: z.array(z.string()).default([]),
      flag: z.string().optional(),
      karma: karmaDeltaSchema.optional(),
    }).optional(),
  })).default([]),

  // ── world tree (meta-progression) ──
  /** World ids that must be completed to unlock this one. */
  unlockRequires: z.array(z.string()).default([]),
  /** Extra conditions gating the unlock (rare). */
  unlockConditions: z.array(conditionSpec).default([]),

  // ── legacy chaining fields (removed once one-life-per-world ships) ──
  nextLevel: z.string().default("none"),
  nextLevels: z.array(z.object({
    levelId: z.string(),
    requires: z.array(conditionSpec).default([]),
  })).optional(),
  act: z.string().optional(),
  /** Victory conditions (formerly the "next-level unlock"). */
  completionConditions: z.array(conditionSpec).default([]),
  /** Legacy alias of `completionConditions`. */
  nextLevelUnlock: z.array(conditionSpec).default([]),
});

export type WorldJsonConfig = z.infer<typeof worldManifestSchema>;
