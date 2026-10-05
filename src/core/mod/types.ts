import type Player from "../../world/Player.js";
import type { Incident, IncidentParameter } from "../../world/Incident.js";
import type EventTypeRegistry from "./EventTypeRegistry.js";
import type NpcTypeRegistry from "../../world/relationships/NpcTypeRegistry.js";
import type { Npc, NpcConstructor } from "../../world/relationships/Npc.js";
import type {
  NpcSchemeResult,
  NpcYearContext,
} from "../../world/relationships/NpcScheme.js";
import type {
  NpcSimEvent,
  NpcTraits,
} from "../../world/relationships/NpcState.js";
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
import type { WorldRuleDef } from "../../world/rules/WorldRule.js";

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
  /** Register an NPC archetype: JSON `type` → class. Needs the "npcs" capability. */
  registerNpcType: (name: string, ctor: NpcConstructor) => void;
  /** Build an Npc subclass from plain behaviour hooks. Needs "npcs". */
  createNpcClass: (def: ModNpcClassDef) => NpcConstructor;
  /** The base Npc class, for mods that would rather `extends` it directly. */
  npcBase: typeof Npc;
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
  /** Register a world rule (a world may then list its id in `worldRules`). */
  addWorldRule: (def: WorldRuleDef) => void;
}

export interface ModEventClassDef {
  apply: (player: Player, self: Incident) => void;
  getWeight?: (player: Player, self: Incident) => number;
}

/**
 * A mod NPC archetype defined with plain behaviour hooks — no manual subclass
 * needed (mirrors `ModEventClassDef`). Mods that want full control can instead
 * `extends ctx.npcBase` and register the class directly via `registerNpcType`.
 */
export interface ModNpcClassDef {
  /** Parse custom `params` fields onto the instance (self). */
  parseParams?: (self: Npc, params: Record<string, unknown>) => void;
  /** Overrides the role/type personality. */
  traits?: NpcTraits;
  /** Player age at which the player comes to know this NPC. */
  knowsFromAge?: number;
  knowsUntilAge?: number;
  /** Age window applied to the NPC's autonomy. */
  autonomyMinAge?: number;
  autonomyMaxAge?: number;
  /** A yearly behaviour against a peer and/or the player. */
  peerScheme?: (self: Npc, ctx: NpcYearContext) => NpcSchemeResult[];
  /** React to a peer's life event this year. */
  reactToPeer?: (
    self: Npc,
    ev: NpcSimEvent,
    ctx: NpcYearContext,
  ) => NpcSchemeResult | null;
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
  /** Register mod NPC archetypes. Needs the "npcs" capability. */
  registerNpcTypes?: (registry: NpcTypeRegistry, ctx: ModContext) => void;
  hooks?: ModHooks;
}
