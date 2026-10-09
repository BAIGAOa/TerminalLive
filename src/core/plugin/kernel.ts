import type RandomService from "../random/RandomService.js";
import type EventDirector from "../../event/EventDirector.js";
import type TypedEventBus from "../TypedEventBus.js";
import type ConfigStore from "../store/ConfigStore.js";
import type LineageStore from "../store/LineageStore.js";
import type WorldManager from "../../worlds/WorldManager.js";
import type EventCenter from "../../event/EventCenter.js";
import type WorldState from "../../world/chronicle/WorldState.js";
import type PoliticsSystem from "../../world/politics/PoliticsSystem.js";
import type EconomySystem from "../../world/economy/EconomySystem.js";
import type HealthSystem from "../../world/health/HealthSystem.js";
import type NarrativeSystem from "../../world/narrative/NarrativeSystem.js";
import type WorldChainSystem from "../../world/chains/WorldChainSystem.js";
import type RegionsSystem from "../../world/regions/RegionsSystem.js";
import type CareerSystem from "../../world/careers/CareerSystem.js";
import type KeyActionRegistry from "../registry/KeyActionRegistry.js";

/**
 * The kernel services a plugin may reach.
 *
 * Kept deliberately small and typed. A plugin that needs the *actual* game
 * systems — the live random stream behind a replay seed, the world manager, the
 * event director — gets them here, by name, from an interface the composition
 * root fills in. The alternative, handing plugins the DI container, would let
 * them construct anything and make the kernel's surface unknowable; this way
 * what a plugin can touch is a type you can read.
 *
 * Only plugins that declare the "kernel" capability are given it.
 */
export interface KernelApi {
  /** The live random stream — the one a replay seed controls (not a fork). */
  readonly random: RandomService;
  readonly director: EventDirector;
  readonly bus: TypedEventBus;
  readonly config: ConfigStore;
  readonly worlds: WorldManager;
  /** The active life's event table, or null between lives. */
  readonly events: () => EventCenter | null;

  // ── the gameplay systems ──────────────────────────────────────
  readonly chronicle: WorldState;
  readonly politics: PoliticsSystem;
  readonly economy: EconomySystem;
  readonly health: HealthSystem;
  readonly narrative: NarrativeSystem;
  readonly chains: WorldChainSystem;
  readonly regions: RegionsSystem;
  readonly lineage: LineageStore;
  readonly careers: CareerSystem;
  /** The rebindable shortcuts, so a plugin can offer one of its own. */
  readonly keyActions: KeyActionRegistry;
}

/**
 * A stand-in for plugins that did not declare the "kernel" capability: every
 * access fails loudly, naming what was refused, instead of handing back a
 * half-working system.
 */
/** Properties that are inspection, not access. */
const KERNEL_INTROSPECTION = new Set([
  "then", // keeps `await ctx.kernel` / `Promise.resolve()` from exploding
  "toJSON",
  "constructor",
  "inspect",
]);

export function deniedKernel(id: string): KernelApi {
  const deny = (what: string): never => {
    throw new Error(
      `插件 "${id}" 未声明 "kernel" 能力，不能访问内核服务 ${what}`,
    );
  };
  return new Proxy({} as KernelApi, {
    get: (_target, property) => {
      // Only *reaching for a service* should fail. Symbols, `then`, `toJSON`
      // and the rest are how a value gets logged, serialised or awaited: a
      // plugin that merely prints its context must not crash the screen.
      if (typeof property === "symbol") return undefined;
      // The value protocol needs something *callable*: leaving `toString`
      // undefined makes `String(ctx.kernel)` throw "Cannot convert object to
      // primitive value" from inside the engine, before any plugin code runs.
      if (property === "toString" || property === "valueOf") {
        return () => `[kernel denied: ${id}]`;
      }
      if (KERNEL_INTROSPECTION.has(property)) return undefined;
      // `events()` is a method, so accessing it is harmless; calling it is not.
      if (property === "events") return () => deny("events");
      return deny(property);
    },
  });
}

/**
 * Holder for the API, installed once at boot.
 *
 * The indirection exists so the kernel never imports the game: the dependency
 * runs composition-root → kernel, never kernel → game, and there is no import
 * cycle to reason about.
 */
export default class KernelServices {
  private api: KernelApi | null = null;

  public install(api: KernelApi): void {
    this.api = api;
  }

  public get installed(): boolean {
    return this.api !== null;
  }

  public get current(): KernelApi {
    if (!this.api) {
      throw new Error("内核服务尚未装配（composition root 未调用 install）");
    }
    return this.api;
  }
}
