import type Player from "../../world/Player.js";
import type { Incident, IncidentParameter } from "../../world/Incident.js";
import type EventTypeRegistry from "./EventTypeRegistry.js";
import type ConfigStore from "../store/ConfigStore.js";
import z from "zod";
import IncidentFilter from "../../event/IncidentFilter.js";
import TypedEventBus from "../TypedEventBus.js";
import { AlgorithmFactory } from "../registry/AlgorithmRegistry.js";
import { Achievement } from "../../achievement/AchievementDefinition.js";
import type { PressureDefinition } from "../../world/pressures/PressureDefinition.js";
import type { PressureRule } from "../../world/pressures/PressureRule.js";
import type { LoreDefinition } from "../../world/chronicle/lore.js";
import type { FateArcDefinition } from "../../world/chronicle/fate.js";
import type { WorldEventDefinition } from "../../world/chronicle/worldEvents.js";
import type { TraitDefinition } from "../../world/traits/TraitDefinition.js";
import type { RandomSource } from "../random/RandomSource.js";
import type { WeightRule } from "../../event/EventDirector.js";

/** The API version this build of the game speaks. */
export const MOD_API_VERSION = 1;

/** Mod manifest (`mod.json`). Missing fields fall back to sensible defaults. */
export const modManifestSchema = z.object({
  /** Stable id (defaults to the folder name). */
  id: z.string().optional(),
  name: z.string(),
  version: z.string().default("0.0.0"),
  apiVersion: z.number().default(MOD_API_VERSION),
  description: z.string().optional(),
  author: z.string().optional(),
  /** Entry file for the JS plugin, relative to the mod folder. */
  main: z.string().default("index.js"),
  /** id → semver range (informational; mismatches warn, not fail). */
  dependencies: z.record(z.string(), z.string()).default({}),
  /**
   * Declared powers (events/items/npcs/levels/world/random/ui/storage). Omitted
   * = legacy content capabilities only (events/items/npcs/levels).
   */
  capabilities: z.array(z.string()).optional(),
});

export type ModManifest = z.infer<typeof modManifestSchema>;

/** A mod resolved from disk: its folder + parsed manifest. */
export interface ResolvedMod {
  dirName: string;
  id: string;
  manifest: ModManifest;
}

export interface ModLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

/**
 * The toolbox a plugin receives. It is the only channel between a mod and the
 * game — no DI container, no filesystem — keeping mods isolated and portable.
 */
export interface ModContext {
  eventBus: TypedEventBus;
  configStore: ConfigStore;
  logger: ModLogger;
  getPlayer: () => Player;
  createEventClass: (
    def: ModEventClassDef,
  ) => new (params: IncidentParameter) => Incident;
  registerScreen: (
    key: string,
    entry: {
      component: React.ComponentType<any>;
      nameKey: string;
      hide?: boolean;
      highlightId?: string;
    },
  ) => void;
  navigateTo: (scene: string) => void;
  addCondition: (
    id: string,
    ctor: new (...args: any[]) => any,
    schema: z.ZodTypeAny,
  ) => void;
  addAlgorithm: (name: string, factory: AlgorithmFactory) => void;
  addFilter: (id: string, filter: () => IncidentFilter) => void;
  addSetting: (
    key: string,
    entry: { component: React.ComponentType<any>; nameKey: string },
  ) => void;
  registerAchievement: (achievement: Achievement) => void;
  // World extension hooks (the Chronicle + hidden scores + weather).
  addPressureAxis: (def: PressureDefinition) => void;
  addPressureRule: (rule: PressureRule) => void;
  addLore: (def: LoreDefinition) => void;
  addFateArc: (def: FateArcDefinition) => void;
  addWorldEvent: (def: WorldEventDefinition) => void;
  addTrait: (def: TraitDefinition) => void;
  /**
   * A deterministic random stream forked for this mod. Draws are reproducible
   * and isolated — they never perturb the main game's sequence, so replays and
   * saves stay stable. Provides weighted pick, shuffle, sample, normal, poisson.
   */
  random: RandomSource;
  /**
   * Register a weight multiplier: `(incident, tags, ctx) => factor`. Runs
   * alongside the built-in director rules; return 1 for "no opinion".
   */
  addWeightRule: (rule: WeightRule) => void;
}

export interface ModEventClassDef {
  apply: (player: Player, self: Incident) => void;
  getWeight?: (player: Player, self: Incident) => number;
}

/** Lifecycle hooks. All optional; called in load order of the mods. */
export interface ModHooks {
  onInit?: (ctx: ModContext) => void | Promise<void>;
  onPlayerCreated?: (player: Player, ctx: ModContext) => void;
  onPlayerUpdate?: (player: Player, ctx: ModContext) => void;
  /** Called after each year ends (post-events resolved). */
  onYear?: (player: Player, ctx: ModContext) => void;
  /** Called when a player resolves a choice. */
  onChoice?: (
    incident: Incident,
    optionId: string,
    player: Player,
    ctx: ModContext,
  ) => void;
  /** Returning false vetoes the incident (the one true intercept). */
  onIncidentTrigger?: (
    incident: Incident,
    player: Player,
    ctx: ModContext,
  ) => boolean | void;
  onIncidentExecuted?: (
    incident: Incident,
    player: Player,
    ctx: ModContext,
  ) => void;
}

/** The object a plugin entry must export (default export or module.exports). */
export interface ModPlugin {
  id: string;
  registerEventTypes?: (registry: EventTypeRegistry, ctx: ModContext) => void;
  hooks?: ModHooks;
}
