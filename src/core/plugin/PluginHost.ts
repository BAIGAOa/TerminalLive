import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentType, createElement } from "react";
import { inject } from "../../Container.js";
import { gotoScreen, registerComponent } from "ink-cartridge";
import ConfigStore from "../store/ConfigStore.js";
import Player from "../../world/Player.js";
import TypedEventBus from "../TypedEventBus.js";
import RandomService from "../random/RandomService.js";
import AlgorithmRegistry from "../registry/AlgorithmRegistry.js";
import FilterRegistry from "../registry/FilterRegistry.js";
import WorldConditionRegistry from "../registry/WorldConditionRegistry.js";
import { SettingRegistry } from "../registry/SettingRegistry.js";
import ReplRegistry from "../repl/ReplRegistry.js";
import { Achievement } from "../../achievement/AchievementDefinition.js";
import AchievementResolver from "../../achievement/AchievementResolver.js";
import PressureRegistry from "../../world/pressures/PressureRegistry.js";
import ChronicleRegistry from "../../world/chronicle/ChronicleRegistry.js";
import TraitRegistry from "../../world/traits/TraitRegistry.js";
import WorldRuleRegistry from "../../world/rules/WorldRuleRegistry.js";
import NpcTypeRegistry from "../../world/relationships/NpcTypeRegistry.js";
import EventDirector from "../../event/EventDirector.js";
import GameStatusMap from "../registry/GameStatusMap.js";
import { UiSlotRegistry } from "./ui.js";
import KernelServices, { deniedKernel } from "./kernel.js";
import { Npc, type NpcConstructor } from "../../world/relationships/Npc.js";
import { inWindow, type AgeWindow } from "../../world/relationships/AgeWindow.js";
import type { NpcSchemeResult, NpcYearContext } from "../../world/relationships/NpcScheme.js";
import type { NpcSimEvent, NpcTraits } from "../../world/relationships/NpcState.js";
import { Incident, IncidentParameter } from "../../world/Incident.js";
import { hasCapability, type Capability } from "../mod/capabilities.js";
import EventTypeRegistry from "../mod/EventTypeRegistry.js";
import ModMonitor from "../mod/ModMonitor.js";
import { PLUGIN_DATA_ROOT } from "../paths.js";
import { translate } from "../language/translator.js";
import { createPluginStorage, type PluginStorage } from "./storage.js";
import { ServiceRegistry } from "./services.js";
import { evaluatePluginEntry } from "./evaluate.js";
import { resolveExecutionMode, type TrustPolicy } from "./trust.js";
import {
  builtinRoot,
  discoverPlugins,
  modRoot,
} from "./discovery.js";
import { planPluginLoad, type PluginEnablement } from "./sources.js";
import type { PluginRef } from "./manifest.js";
import FirstPartyPlugins from "./FirstParty.js";
import type {
  Plugin,
  PluginContext,
  PluginEventClassDef,
  PluginEvents,
  PluginNpcClassDef,
} from "./types.js";

/** A plugin that mounted successfully, plus everything it owns. */
interface MountedPlugin {
  ref: PluginRef;
  plugin: Plugin;
  ctx: PluginContext;
  /** Undo functions: event subscriptions, weight rules, … run on unload. */
  disposers: Array<() => void>;
}

/** A lifecycle hook, bound to its plugin, with the context it was handed. */
interface HookEntry {
  fn: (...args: any[]) => any;
  ctx: PluginContext;
  id: string;
}

const logSink = {
  info: (m: string) => console.log(m),
  warn: (m: string) => console.warn(m),
  error: (m: string) => console.error(m),
};

/**
 * The kernel's plugin host: finds plugins, decides what may load, evaluates
 * their entries, hands them the extension API, and runs their lifecycle.
 *
 * One host serves every source — first-party TypeScript plugins compiled into
 * the game, shipped plugins in `resource/plugins/`, and user mods under
 * `~/.mod_live/`. Only discovery and evaluation differ; the API and the
 * capability gate are identical, which is what "everything is a plugin" has to
 * mean in practice.
 */
export default class PluginHost {
  private monitor = inject(ModMonitor);
  private firstParty = inject(FirstPartyPlugins);
  private configStore = inject(ConfigStore);
  private eventBus = inject(TypedEventBus);
  private eventTypeRegistry = inject(EventTypeRegistry);
  private npcTypeRegistry = inject(NpcTypeRegistry);
  private conditionReg = inject(WorldConditionRegistry);
  private algoRegister = inject(AlgorithmRegistry);
  private filterRegister = inject(FilterRegistry);
  private settingCenter = inject(SettingRegistry);
  private replRegistry = inject(ReplRegistry);
  private achievementResolver = inject(AchievementResolver);
  private pressureRegistry = inject(PressureRegistry);
  private worldRegistry = inject(ChronicleRegistry);
  private traitRegistry = inject(TraitRegistry);
  private worldRuleRegistry = inject(WorldRuleRegistry);
  private director = inject(EventDirector);
  private statusViews = inject(GameStatusMap);
  private uiSlots = inject(UiSlotRegistry);
  private kernelServices = inject(KernelServices);

  private services = new ServiceRegistry();
  private playerRef: Player | null = null;
  private mounted: MountedPlugin[] = [];
  private screens = new Map<string, ComponentType<any>>();
  private weightRuleSeq = 0;
  /** Explicit override; when null the config decides (see {@link policy}). */
  private trustPolicy: TrustPolicy | null = null;

  private incidentTriggerHooks: HookEntry[] = [];
  private incidentExecutedHooks: HookEntry[] = [];
  private playerUpdateHooks: HookEntry[] = [];
  private playerCreatedHooks: HookEntry[] = [];
  private yearHooks: HookEntry[] = [];
  private choiceHooks: HookEntry[] = [];
  private worldStartHooks: HookEntry[] = [];
  private lifeEndHooks: HookEntry[] = [];

  /**
   * Plugin-defined chronicle/pressure content, remembered so it can be
   * re-applied after a world replaces (clears) that category's registry.
   */
  private scopedOverlay = {
    lore: [] as unknown[],
    fates: [] as unknown[],
    worldEvents: [] as unknown[],
    pressureAxes: [] as unknown[],
    pressureRules: [] as unknown[],
  };

  constructor() {
    this.bindLifecycle();
  }

  /**
   * Translate the game's own events into plugin lifecycle hooks.
   *
   * Subscribing here rather than calling into the host from the world code
   * keeps the game's systems unaware of the plugin layer: they emit an event
   * they were already emitting, and plugins get a hook.
   */
  private bindLifecycle(): void {
    this.eventBus.on("level:started", ({ levelId }) => {
      if (this.playerRef) this.fireWorldStart(levelId, this.playerRef);
    });
    this.eventBus.on("game:over", ({ reason, age }) => {
      if (this.playerRef) this.fireLifeEnd({ reason, age }, this.playerRef);
    });
  }

  public setPlayer(player: Player): void {
    this.playerRef = player;
  }

  /** Override how plugins are trusted (settings screen, tests). */
  public setTrustPolicy(policy: TrustPolicy): void {
    this.trustPolicy = policy;
  }

  /** The trust policy in force: an explicit override, else the config. */
  private policy(): TrustPolicy {
    return (
      this.trustPolicy ?? { trusted: this.configStore.getTrustedPlugins() }
    );
  }

  // ── discovery ─────────────────────────────────────────────────

  /** Every plugin on disk or compiled in, enabled or not. */
  public discover(): PluginRef[] {
    return [
      ...this.firstPartyRefs(),
      ...discoverPlugins(builtinRoot()),
      ...discoverPlugins(modRoot(this.monitor.MOD_ROOT)),
    ];
  }

  /** The enablement the config currently expresses. */
  public enablement(): PluginEnablement {
    return {
      mods: this.configStore.getEnabledMods(),
      builtins: this.configStore.getEnabledBuiltinPlugins(),
      disabled: this.configStore.getDisabledPlugins(),
    };
  }

  /** First-party plugins, as refs, with their code-declared manifest. */
  private firstPartyRefs(): PluginRef[] {
    return this.firstParty.all().map((entry) => ({
      id: entry.plugin.id,
      dirName: entry.plugin.id,
      dir: join(this.firstParty.rootDir, entry.plugin.id),
      source: "core" as const,
      manifest: entry.manifest,
    }));
  }

  // ── lifecycle ─────────────────────────────────────────────────

  /** Mount every enabled plugin, in dependency order. Safe to call once. */
  public loadEnabled(): void {
    const { order, skipped } = planPluginLoad(this.discover(), this.enablement());
    for (const s of skipped) {
      console.warn(`[plugin] 跳过 "${s.dirName}": ${s.reason}`);
    }
    for (const ref of order) this.mount(ref);
  }

  /** Unload everything and mount the current configuration again. */
  public reloadEnabled(): void {
    this.unloadAll();
    this.loadEnabled();
  }

  /** Run every plugin's `onDispose`, then retract everything it owns. */
  public unloadAll(): void {
    for (const entry of [...this.mounted].reverse()) {
      const { plugin, ctx } = entry;
      if (plugin.hooks?.onDispose) {
        safe(`${ctx.id}.onDispose`, () => plugin.hooks?.onDispose?.(ctx));
      }
      for (const dispose of entry.disposers.splice(0)) {
        safe(`${ctx.id}.dispose`, dispose);
      }
      this.services.retractAll(ctx.id);
      this.uiSlots.clearOwner(ctx.id);
    }
    this.mounted = [];
    // Contributions that live in registries rather than in disposers are reset
    // wholesale — a reload must never stack duplicates.
    this.incidentTriggerHooks = [];
    this.incidentExecutedHooks = [];
    this.playerUpdateHooks = [];
    this.playerCreatedHooks = [];
    this.yearHooks = [];
    this.choiceHooks = [];
    this.worldStartHooks = [];
    this.lifeEndHooks = [];
    this.screens.clear();
    this.weightRuleSeq = 0;
    this.scopedOverlay = {
      lore: [],
      fates: [],
      worldEvents: [],
      pressureAxes: [],
      pressureRules: [],
    };
  }

  /**
   * Re-apply plugin chronicle/pressure content after a world cleared a
   * category's registry. Non-cleared categories keep the content already in the
   * restored baseline.
   */
  public applyScopedOverlay(
    cleared: { chronicle?: boolean; pressures?: boolean } = {},
  ): void {
    if (cleared.chronicle) {
      for (const def of this.scopedOverlay.lore) {
        try {
          this.worldRegistry.registerLore(def as never);
        } catch {
          /* already present */
        }
      }
      for (const def of this.scopedOverlay.fates) {
        try {
          this.worldRegistry.registerFate(def as never);
        } catch {
          /* already present */
        }
      }
      for (const def of this.scopedOverlay.worldEvents) {
        try {
          this.worldRegistry.registerWorldEvent(def as never);
        } catch {
          /* already present */
        }
      }
    }
    if (cleared.pressures) {
      for (const def of this.scopedOverlay.pressureAxes) {
        const id = (def as { id: string }).id;
        if (!this.pressureRegistry.hasAxis(id)) {
          this.pressureRegistry.registerAxis(def as never);
        }
      }
      for (const rule of this.scopedOverlay.pressureRules) {
        this.pressureRegistry.registerRule(rule as never);
      }
    }
  }

  // ── mounting ──────────────────────────────────────────────────

  private mount(ref: PluginRef): void {
    const plugin = this.resolvePlugin(ref);
    if (!plugin) return;

    const entry: MountedPlugin = {
      ref,
      plugin,
      ctx: undefined as unknown as PluginContext,
      disposers: [],
    };
    entry.ctx = this.createContext(ref, entry.disposers);

    const manifest = ref.manifest;
    if (hasCapability(manifest, "events")) {
      safe(`${ref.id}.registerEventTypes`, () =>
        plugin.registerEventTypes?.(
          this.scopedTypes(this.eventTypeRegistry, "unregister", entry.disposers),
          entry.ctx,
        ),
      );
    } else if (plugin.registerEventTypes) {
      console.warn(`[plugin] "${ref.id}" 未声明 "events" 能力，忽略 registerEventTypes`);
    }
    if (hasCapability(manifest, "npcs")) {
      safe(`${ref.id}.registerNpcTypes`, () =>
        plugin.registerNpcTypes?.(
          this.scopedTypes(this.npcTypeRegistry, "unregister", entry.disposers),
          entry.ctx,
        ),
      );
    } else if (plugin.registerNpcTypes) {
      console.warn(`[plugin] "${ref.id}" 未声明 "npcs" 能力，忽略 registerNpcTypes`);
    }

    this.mounted.push(entry);
    this.registerHooks(plugin, entry.ctx);

    const initResult = safe(`${ref.id}.onInit`, () => plugin.hooks?.onInit?.(entry.ctx));
    if (initResult && typeof (initResult as Promise<unknown>).catch === "function") {
      (initResult as Promise<unknown>).catch((err) =>
        console.error(`[plugin] "${ref.id}".onInit 异步失败:`, err),
      );
    }

    // Only user mods announce themselves: this drives the console's "mod
    // loaded" notification, and the shipped plugins would spam it at boot.
    if (ref.source === "mod") {
      this.eventBus.emit("moder:loadSuccess", { modName: ref.id });
    }
  }

  /**
   * A type registry as a plugin sees it, with its registrations recorded.
   *
   * `register` has to be undoable, or a hot reload cannot replace an event or
   * NPC class: the re-registration comes back as a duplicate, the error is
   * isolated (as every plugin error is), and the freshly-edited class is
   * silently dropped in favour of the stale one — the exact thing hot reload
   * exists to avoid. Everything else forwards untouched.
   */
  private scopedTypes<T extends object>(
    registry: T,
    removeMethod: keyof T,
    disposers: Array<() => void>,
  ): T {
    return new Proxy(registry, {
      get: (target, property) => {
        if (property === "register") {
          const register = (
            target as unknown as {
              register: (name: string, ...rest: unknown[]) => void;
            }
          ).register.bind(target);
          const remove = (
            target as unknown as Record<string, (name: string) => void>
          )[removeMethod as string].bind(target);
          return (name: string, ...rest: unknown[]) => {
            register(name, ...rest);
            disposers.push(() => remove(name));
          };
        }
        const value = Reflect.get(target, property) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }

  /** A first-party module, a shipped entry file, or a user mod's JS. */
  private resolvePlugin(ref: PluginRef): Plugin | null {
    const firstParty = this.firstParty.get(ref.id);
    if (firstParty) return firstParty.plugin;

    const mainPath = join(ref.dir, ref.manifest.main);
    let source: string;
    try {
      source = readFileSync(mainPath, "utf-8");
    } catch {
      // A data-only plugin (JSON content, no code) is legitimate.
      return { id: ref.id };
    }

    let exported: any;
    try {
      exported = evaluatePluginEntry(source, {
        filename: mainPath,
        mode: resolveExecutionMode(ref.manifest, this.policy()),
      });
    } catch (err) {
      console.error(`[plugin] 加载 "${ref.id}" 失败:`, (err as Error).message);
      return null;
    }

    const plugin = exported?.default ?? exported;
    if (!plugin || typeof plugin !== "object" || typeof plugin.id !== "string") {
      console.warn(`[plugin] "${ref.id}" 未导出合法的 Plugin（跳过）`);
      return null;
    }
    return plugin;
  }

  private registerHooks(plugin: Plugin, ctx: PluginContext): void {
    const h = plugin.hooks;
    if (!h) return;
    const bind = (fn: (...a: any[]) => any): HookEntry => ({
      fn: fn.bind(plugin),
      ctx,
      id: ctx.id,
    });
    if (h.onIncidentTrigger) this.incidentTriggerHooks.push(bind(h.onIncidentTrigger));
    if (h.onIncidentExecuted) this.incidentExecutedHooks.push(bind(h.onIncidentExecuted));
    if (h.onPlayerUpdate) this.playerUpdateHooks.push(bind(h.onPlayerUpdate));
    if (h.onPlayerCreated) this.playerCreatedHooks.push(bind(h.onPlayerCreated));
    if (h.onYear) this.yearHooks.push(bind(h.onYear));
    if (h.onChoice) this.choiceHooks.push(bind(h.onChoice));
    if (h.onWorldStart) this.worldStartHooks.push(bind(h.onWorldStart));
    if (h.onLifeEnd) this.lifeEndHooks.push(bind(h.onLifeEnd));
  }

  // ── hook dispatch (each call error-isolated) ──────────────────

  public firePlayerCreated(player: Player): void {
    for (const { fn, ctx } of this.playerCreatedHooks) {
      safe("onPlayerCreated", () => fn(player, ctx));
    }
  }

  public firePlayerUpdate(player: Player): void {
    for (const { fn, ctx } of this.playerUpdateHooks) {
      safe("onPlayerUpdate", () => fn(player, ctx));
    }
  }

  public fireYear(player: Player): void {
    for (const { fn, ctx } of this.yearHooks) safe("onYear", () => fn(player, ctx));
  }

  public fireWorldStart(levelId: string, player: Player): void {
    for (const { fn, ctx } of this.worldStartHooks) {
      safe("onWorldStart", () => fn(levelId, player, ctx));
    }
  }

  public fireLifeEnd(
    outcome: { reason: "death" | "complete"; age: number },
    player: Player,
  ): void {
    for (const { fn, ctx } of this.lifeEndHooks) {
      safe("onLifeEnd", () => fn(outcome, player, ctx));
    }
  }

  public fireChoice(incident: Incident, optionId: string, player: Player): void {
    for (const { fn, ctx } of this.choiceHooks) {
      safe("onChoice", () => fn(incident, optionId, player, ctx));
    }
  }

  public fireIncidentTrigger(incident: Incident, player: Player): boolean {
    for (const { fn, ctx } of this.incidentTriggerHooks) {
      if (safe("onIncidentTrigger", () => fn(incident, player, ctx)) === false) {
        return false;
      }
    }
    return true;
  }

  public fireIncidentExecuted(incident: Incident, player: Player): void {
    for (const { fn, ctx } of this.incidentExecutedHooks) {
      safe("onIncidentExecuted", () => fn(incident, player, ctx));
    }
  }

  // ── introspection ─────────────────────────────────────────────

  /** The plugins currently mounted, in load order. */
  public getLoadedRefs(): PluginRef[] {
    return this.mounted.map((m) => m.ref);
  }

  /**
   * The loaded *mods* — user plugins only. The console's "N mods reloaded"
   * message and the hot-reload watcher report this, and counting the plugins
   * the game ships with would make the number meaningless.
   */
  public getLoadedMods(): PluginRef[] {
    return this.mounted.filter((m) => m.ref.source === "mod").map((m) => m.ref);
  }

  public loadedIds(): string[] {
    return this.mounted.map((m) => m.ctx.id);
  }

  public isMounted(id: string): boolean {
    return this.mounted.some((m) => m.ctx.id === id);
  }

  public getContext(id: string): PluginContext | undefined {
    return this.mounted.find((m) => m.ctx.id === id)?.ctx;
  }

  /** Every service id plugins currently publish. */
  public serviceIds(): string[] {
    return this.services.ids();
  }

  // ── the API surface a plugin receives ─────────────────────────

  private createContext(
    ref: PluginRef,
    disposers: Array<() => void>,
  ): PluginContext {
    const id = ref.id;
    const manifest = ref.manifest;

    // Capability gate: a plugin only gets the powers its manifest declares.
    // `can` is for an API the plugin actually called — that refusal is worth a
    // warning naming the capability. `may` is for building the context itself:
    // every plugin gets a storage handle and a kernel handle, and a plugin that
    // never touches them must not be warned about lacking them.
    const may = (cap: Capability): boolean => hasCapability(manifest, cap);
    const can = (cap: Capability): boolean => {
      const ok = may(cap);
      if (!ok) {
        console.warn(`[plugin] "${id}" 未声明 "${cap}" 能力，调用被拒绝`);
      }
      return ok;
    };
    // Swallow duplicate-registration throws so a hot reload (which re-runs
    // onInit against already-populated registries) can't abort the rest of it.
    const reg = (fn: () => void, label: string) => {
      try {
        fn();
      } catch (err) {
        console.warn(
          `[plugin] "${id}" ${label} 注册失败（可能重复）:`,
          (err as Error).message,
        );
      }
    };

    return {
      id,
      t: (key, params) => translate(key, params),
      events: this.scopedEvents(disposers),
      eventBus: this.eventBus,
      configStore: this.configStore,
      logger: {
        info: (msg) => logSink.info(`[${id}] ${msg}`),
        warn: (msg) => logSink.warn(`[${id}] ${msg}`),
        error: (msg) => logSink.error(`[${id}] ${msg}`),
      },
      getPlayer: () => {
        if (!this.playerRef) throw new Error("Player 未初始化");
        return this.playerRef;
      },
      random: inject(RandomService).fork(id),
      storage: this.storageFor(id, may("storage")),
      services: this.services.forOwner(id),
      kernel: may("kernel") ? this.kernelServices.current : deniedKernel(id),

      createEventClass: (def: PluginEventClassDef) => {
        if (!can("events")) return this.makeEventClass({ apply: () => {} });
        return this.makeEventClass(def);
      },
      registerNpcType: (name: string, ctor: NpcConstructor) => {
        if (!can("npcs")) return;
        reg(() => this.npcTypeRegistry.register(name, ctor), "npcType");
      },
      createNpcClass: (def: PluginNpcClassDef) => {
        if (!can("npcs")) return this.makeNpcClass({});
        return this.makeNpcClass(def);
      },
      npcBase: Npc,

      addCondition: (cid, ctor, schema) => {
        if (can("events")) {
          reg(() => this.conditionReg.register(cid, { ctor, schema }), "condition");
        }
      },
      addAlgorithm: (name, factory) => {
        if (can("events")) reg(() => this.algoRegister.register(name, factory), "algorithm");
      },
      addFilter: (fid, filter) => {
        if (can("events")) reg(() => this.filterRegister.register(fid, filter), "filter");
      },
      registerAchievement: (achievement: Achievement) => {
        reg(() => this.achievementResolver.registerSingle(achievement), "achievement");
      },
      addPressureAxis: (def) => {
        if (!can("world")) return;
        this.scopedOverlay.pressureAxes.push(def);
        if (!this.pressureRegistry.hasAxis(def.id)) {
          reg(() => this.pressureRegistry.registerAxis(def), "pressureAxis");
        }
      },
      addPressureRule: (rule) => {
        if (!can("world")) return;
        this.scopedOverlay.pressureRules.push(rule);
        reg(() => this.pressureRegistry.registerRule(rule), "pressureRule");
      },
      addLore: (def) => {
        if (!can("world")) return;
        this.scopedOverlay.lore.push(def);
        reg(() => this.worldRegistry.registerLore(def), "lore");
      },
      addFateArc: (def) => {
        if (!can("world")) return;
        this.scopedOverlay.fates.push(def);
        reg(() => this.worldRegistry.registerFate(def), "fate");
      },
      addWorldEvent: (def) => {
        if (!can("world")) return;
        this.scopedOverlay.worldEvents.push(def);
        reg(() => this.worldRegistry.registerWorldEvent(def), "worldEvent");
      },
      addTrait: (def) => {
        if (!can("world")) return;
        if (!this.traitRegistry.has(def.id)) {
          reg(() => this.traitRegistry.register(def), "trait");
        }
      },
      addWorldRule: (def) => {
        if (!can("world")) return;
        reg(() => {
          if (!this.worldRuleRegistry.has(def.id)) {
            this.worldRuleRegistry.register(def.id, def);
          }
        }, "worldRule");
      },
      addWeightRule: (rule) => {
        const ruleId = `${id}:rule${++this.weightRuleSeq}`;
        disposers.push(this.director.addRule(ruleId, rule));
      },

      registerScreen: (key, screen) => {
        if (!can("ui")) return;
        this.screens.set(key, screen.component);
        const parent = (screen as { parent?: ComponentType<any> }).parent;
        reg(
          () => registerComponent(screen.component, {}, parent ? { parent } : undefined),
          "screen",
        );
      },
      navigateTo: (scene: string) => {
        if (!can("ui")) return;
        const target = this.screens.get(scene);
        if (!target) {
          console.warn(`[plugin] navigateTo: 未注册的屏幕 "${scene}"`);
          return;
        }
        gotoScreen(target, {});
      },
      overrideScreen: (slot, component, options) => {
        if (!can("ui")) return;
        if (this.uiSlots.best(slot)) {
          console.log(`[plugin] "${id}" 接管了界面 "${slot}"`);
        }
        this.uiSlots.provide(slot, component, id, options?.priority ?? 0);
      },
      addStatusView: (viewId, view) => {
        if (!can("ui")) return;
        const previous = this.statusViews.tryGet(viewId);
        if (previous) console.log(`[plugin] "${id}" 替换了状态面板 "${viewId}"`);
        this.statusViews.set(viewId, (props?: any) => createElement(view, props));
        // Put back what this plugin displaced. Without it, disabling the plugin
        // leaves its panel (and its code) live on a host that believes it
        // unloaded.
        disposers.push(() => this.restore(this.statusViews, viewId, previous));
      },
      addSetting: (key, setting) => {
        if (!can("ui")) return;
        const previous = this.settingCenter.tryGet(key);
        if (previous) console.log(`[plugin] "${id}" 替换了设置页 "${key}"`);
        reg(() => this.settingCenter.set(key, setting), "setting");
        disposers.push(() => this.restore(this.settingCenter, key, previous));
      },
      addCommand: (command) => {
        if (!can("ui")) return;
        const previous = this.replRegistry.resolve(command.name);
        if (previous) console.log(`[plugin] "${id}" 替换了指令 "${command.name}"`);
        reg(() => this.replRegistry.set(command), "command");
        disposers.push(() => {
          if (previous) this.replRegistry.set(previous);
          else this.replRegistry.remove(command);
        });
      },
    };
  }

  /** Put back what a plugin displaced, or drop what it added. */
  private restore<T>(
    registry: {
      set(key: string, value: T): boolean;
      has(key: string): boolean;
      unregister(key: string): void;
    },
    key: string,
    previous: T | undefined,
  ): void {
    try {
      if (previous !== undefined) registry.set(key, previous);
      else if (registry.has(key)) registry.unregister(key);
    } catch {
      /* the registry is gone (screen teardown) — nothing to restore */
    }
  }

  /**
   * A plugin's view of the event bus: subscribing through it records the
   * unsubscriber on the plugin's own list, so unloading can never leave a live
   * listener pointing at a dead plugin.
   */
  private scopedEvents(disposers: Array<() => void>): PluginEvents {
    return {
      on: (event, listener) => {
        const off = this.eventBus.on(event as never, listener as never);
        disposers.push(off);
        return off;
      },
      emit: (event, ...args) =>
        (this.eventBus.emit as unknown as (e: string, ...a: unknown[]) => void)(
          event as string,
          ...args,
        ),
    };
  }

  /** Storage for a plugin; without the capability it is an inert store. */
  private storageFor(id: string, allowed: boolean): PluginStorage {
    if (!allowed) {
      // Denied storage behaves as an empty store rather than throwing — a
      // capability miss must not take the plugin down, and a plugin that
      // declared what it needs never lands here.
      return {
        read: <T>(fallback: T) => fallback,
        write: () => {},
        update: <T>(fn: (c: T) => T, fallback: T) => fn(fallback),
        clear: () => {},
      };
    }
    return createPluginStorage(PLUGIN_DATA_ROOT, id);
  }

  private makeEventClass(
    def: PluginEventClassDef,
  ): new (params: IncidentParameter) => Incident {
    return class DynamicEvent extends Incident {
      constructor(params: IncidentParameter) {
        super(params);
      }
      apply(player: Player): void {
        def.apply(player, this);
      }
      getWeight(player: Player): number {
        return def.getWeight?.(player, this) ?? this.weight;
      }
    };
  }

  /** Adaptation of {@link PluginNpcClassDef} into a concrete Npc subclass. */
  private makeNpcClass(def: PluginNpcClassDef): NpcConstructor {
    return class DynamicNpc extends Npc {
      protected parseParams(params: Record<string, unknown>): void {
        def.parseParams?.(this, params);
      }
      public traits(): NpcTraits {
        return def.traits ?? super.traits();
      }
      public knowsAt(playerAge: number): boolean {
        if (def.knowsFromAge !== undefined || def.knowsUntilAge !== undefined) {
          return inWindow(playerAge, {
            min: def.knowsFromAge,
            max: def.knowsUntilAge,
          });
        }
        return super.knowsAt(playerAge);
      }
      public autonomyAgeWindow(): AgeWindow {
        return { min: def.autonomyMinAge, max: def.autonomyMaxAge };
      }
      public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
        return def.peerScheme ? def.peerScheme(this, ctx) : [];
      }
      public reactToPeer(
        ev: NpcSimEvent,
        ctx: NpcYearContext,
      ): NpcSchemeResult | null {
        return def.reactToPeer ? def.reactToPeer(this, ev, ctx) : null;
      }
    };
  }
}

/** Run a plugin callback, isolating any throw from the rest of the game. */
function safe<T>(label: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (err) {
    console.error(`[plugin] ${label} 执行出错（已隔离）:`, (err as Error).message);
  }
  return undefined;
}
