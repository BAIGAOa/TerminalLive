import type Player from "../../world/Player.js";
import type { Incident, IncidentParameter } from "../../world/Incident.js";
import type EventTypeRegistry from "../mod/EventTypeRegistry.js";
import type NpcTypeRegistry from "../../world/relationships/NpcTypeRegistry.js";
import type { Npc, NpcConstructor } from "../../world/relationships/Npc.js";
import type {
  NpcSchemeResult,
  NpcYearContext,
} from "../../world/relationships/NpcScheme.js";
import type { NpcSimEvent, NpcTraits } from "../../world/relationships/NpcState.js";
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
import type { ReplCommand, TranslateFn } from "../repl/types.js";
import type { PluginStorage } from "./storage.js";
import type { KernelApi } from "./kernel.js";
import type { PluginServices } from "./services.js";

/**
 * The plugin contract.
 *
 * One contract serves every plugin: shipped first-party features (compiled from
 * `src/plugins/`), shipped data packages (`resource/plugins/`), and user mods
 * (`~/.mod_live/`). They differ in *where they come from* and *how they are
 * evaluated* — never in what they may do.
 */

/** Everything a plugin may do to the game. */
export interface PluginContext {
  /** The plugin's resolved id. */
  readonly id: string;
  /** Translate an i18n key with the player's selected language. */
  t: TranslateFn;

  // ── kernel services ───────────────────────────────────────────
  /**
   * The game event bus, scoped to this plugin: every subscription made through
   * it is torn down automatically when the plugin unloads, so a hot reload can
   * never leave a stale listener behind.
   */
  events: PluginEvents;
  /** Unscoped bus, for the rare case of forwarding into another plugin's stream. */
  eventBus: TypedEventBus;
  configStore: ConfigStore;
  logger: PluginLogger;
  getPlayer: () => Player;
  /**
   * A deterministic random stream forked for this plugin. Draws are reproducible
   * and isolated — they never perturb the main game's sequence, so replays and
   * saves stay stable. Provides weighted pick, shuffle, sample, normal, poisson.
   */
  random: RandomSource;
  /** Per-plugin persistent storage (needs the "storage" capability). */
  storage: PluginStorage;
  /**
   * Named services published by other plugins. Lets plugins extend each other,
   * not just the game: publish a small interface under an id, and anyone who
   * declares a dependency on you can consume it.
   */
  services: PluginServices;
  /**
   * The game systems themselves (live random stream, worlds, director).
   * Needs the "kernel" capability — granted to trusted, deep plugins.
   */
  kernel: KernelApi;

  // ── content extension points ──────────────────────────────────
  createEventClass: (
    def: PluginEventClassDef,
  ) => new (params: IncidentParameter) => Incident;
  /** Register an NPC archetype: JSON `type` → class. Needs the "npcs" capability. */
  registerNpcType: (name: string, ctor: NpcConstructor) => void;
  /** Build an Npc subclass from plain behaviour hooks. Needs "npcs". */
  createNpcClass: (def: PluginNpcClassDef) => NpcConstructor;
  /** The base Npc class, for plugins that would rather `extends` it directly. */
  npcBase: typeof Npc;
  addCondition: (
    id: string,
    ctor: new (...args: any[]) => any,
    schema: z.ZodTypeAny,
  ) => void;
  addAlgorithm: (name: string, factory: AlgorithmFactory) => void;
  addFilter: (id: string, filter: () => IncidentFilter) => void;
  registerAchievement: (achievement: Achievement) => void;
  // World extension hooks (the Chronicle + hidden scores + weather).
  addPressureAxis: (def: PressureDefinition) => void;
  addPressureRule: (rule: PressureRule) => void;
  addLore: (def: LoreDefinition) => void;
  addFateArc: (def: FateArcDefinition) => void;
  addWorldEvent: (def: WorldEventDefinition) => void;
  addTrait: (def: TraitDefinition) => void;
  /**
   * Register a weight multiplier: `(incident, tags, ctx) => factor`. Runs
   * alongside the built-in director rules; return 1 for "no opinion".
   */
  addWeightRule: (rule: WeightRule) => void;
  /** Register a world rule (a world may then list its id in `worldRules`). */
  addWorldRule: (def: WorldRuleDef) => void;

  // ── UI extension points ───────────────────────────────────────
  /** Add a brand-new screen, reachable via `navigateTo`. Needs "ui". */
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
  /**
   * Take over one of the game's named screens (see `SCREEN_SLOTS`). The
   * highest-priority provider wins, so a plugin can replace the main menu, a
   * settings page, or the in-game screen outright. Needs "ui".
   */
  overrideScreen: (
    slot: string,
    component: React.ComponentType<any>,
    options?: { priority?: number },
  ) => void;
  /**
   * Add or **replace** an in-game status panel by id ("attributes", "skills",
   * …). A plugin that provides an id the game already uses takes that panel
   * over. Needs "ui".
   */
  addStatusView: (id: string, view: React.ComponentType<any>) => void;
  /** Add or replace a settings page. Needs "ui". */
  addSetting: (
    key: string,
    entry: { component: React.ComponentType<any>; nameKey: string },
  ) => void;
  /** Add or replace a console (`P`) command, aliases included. Needs "ui". */
  addCommand: (command: ReplCommand) => void;
}

/** The event bus as a plugin sees it: subscriptions are owned, not global. */
export interface PluginEvents {
  on<K extends keyof EventMap>(
    event: K,
    listener: EventMap[K] extends void
      ? () => void
      : (payload: EventMap[K]) => void,
  ): () => void;
  emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [payload: EventMap[K]]
  ): void;
}

export interface PluginLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface PluginEventClassDef {
  apply: (player: Player, self: Incident) => void;
  getWeight?: (player: Player, self: Incident) => number;
}

/**
 * A plugin NPC archetype defined with plain behaviour hooks — no manual subclass
 * needed (mirrors `PluginEventClassDef`). Plugins that want full control can
 * instead `extends ctx.npcBase` and register the class directly.
 */
export interface PluginNpcClassDef {
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

/**
 * Lifecycle hooks. All optional, called in load order.
 *
 * The world/life/turn hooks are conveniences over the event bus — a plugin that
 * needs anything else can subscribe to `ctx.events` directly.
 */
export interface PluginHooks {
  onInit?: (ctx: PluginContext) => void | Promise<void>;
  /** The plugin is about to be unloaded (hot reload, or shutdown). */
  onDispose?: (ctx: PluginContext) => void | Promise<void>;
  onPlayerCreated?: (player: Player, ctx: PluginContext) => void;
  onPlayerUpdate?: (player: Player, ctx: PluginContext) => void;
  /** Called after each year ends (post-events resolved). */
  onYear?: (player: Player, ctx: PluginContext) => void;
  /** A world (level) started — a life begins or resumes. */
  onWorldStart?: (levelId: string, player: Player, ctx: PluginContext) => void;
  /** A life ended: death or a completed world. */
  onLifeEnd?: (
    outcome: { reason: "death" | "complete"; age: number },
    player: Player,
    ctx: PluginContext,
  ) => void;
  /** Called when a player resolves a choice. */
  onChoice?: (
    incident: Incident,
    optionId: string,
    player: Player,
    ctx: PluginContext,
  ) => void;
  /** Returning false vetoes the incident (the one true intercept). */
  onIncidentTrigger?: (
    incident: Incident,
    player: Player,
    ctx: PluginContext,
  ) => boolean | void;
  onIncidentExecuted?: (
    incident: Incident,
    player: Player,
    ctx: PluginContext,
  ) => void;
}

/** The object a plugin entry (or a first-party module) must export. */
export interface Plugin {
  id: string;
  /** Register content types before any JSON is parsed. */
  registerEventTypes?: (registry: EventTypeRegistry, ctx: PluginContext) => void;
  /** Register NPC archetypes. Needs the "npcs" capability. */
  registerNpcTypes?: (registry: NpcTypeRegistry, ctx: PluginContext) => void;
  hooks?: PluginHooks;
}

/** A first-party plugin module: the default export of `src/plugins/<id>/index.ts`. */
export type PluginModule = Plugin;

// ── back-compat aliases ────────────────────────────────────────
// The user-mod side of the codebase still reads as "mods"; the contract is the
// kernel's, and these names keep existing call sites compiling during the
// migration to a single plugin model.
export type ModContext = PluginContext;
export type ModPlugin = Plugin;
export type ModHooks = PluginHooks;
export type ModEventClassDef = PluginEventClassDef;
export type ModNpcClassDef = PluginNpcClassDef;
export type ModLogger = PluginLogger;
