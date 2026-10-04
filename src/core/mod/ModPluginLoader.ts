import { inject } from "../../Container.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentType } from "react";
import EventTypeRegistry from "./EventTypeRegistry.js";
import ConfigStore from "../store/ConfigStore.js";
import Player from "../../world/Player.js";
import { Incident, IncidentParameter } from "../../world/Incident.js";
import { ModContext, ModPlugin, ModEventClassDef, ResolvedMod } from "./types.js";
import { gotoScreen, registerComponent } from "ink-cartridge";
import TypedEventBus from "../TypedEventBus.js";
import ModMonitor from "./ModMonitor.js";
import AlgorithmRegistry from "../registry/AlgorithmRegistry.js";
import FilterRegistry from "../registry/FilterRegistry.js";
import LevelConditionRegistry from "../registry/LevelConditionRegistry.js";
import { SettingRegistry } from "../registry/SettingRegistry.js";
import AchievementResolver from "../../achievement/AchievementResolver.js";
import { Achievement } from "../../achievement/AchievementDefinition.js";
import PressureRegistry from "../../world/pressures/PressureRegistry.js";
import WorldRegistry from "../../world/chronicle/WorldRegistry.js";
import TraitRegistry from "../../world/traits/TraitRegistry.js";
import { resolveLoadOrder } from "./loadOrder.js";
import { loadModModule } from "./sandbox.js";
import RandomService from "../random/RandomService.js";
import EventDirector from "../../event/EventDirector.js";
import { hasCapability } from "./capabilities.js";

interface HookEntry {
  fn: (...args: any[]) => any;
  ctx: ModContext;
}

const noopLogger = {
  info: (m: string) => console.log(m),
  warn: (m: string) => console.warn(m),
  error: (m: string) => console.error(m),
};

function safe(label: string, fn: () => unknown): unknown {
  try {
    return fn();
  } catch (err) {
    console.error(`[Mod] ${label} 执行出错（已隔离）:`, (err as Error).message);
    return undefined;
  }
}

/**
 * Loads mod plugins: dependency-ordered, error-isolated, with a broad API for
 * extending the game (events, world, hidden scores, weather, screens…).
 */
export default class ModPluginLoader {
  private registry: ModMonitor;
  private eventTypeRegistry: EventTypeRegistry;
  private eventBus: TypedEventBus;
  private configStore: ConfigStore;
  private conditionReg: LevelConditionRegistry;
  private algoRegister: AlgorithmRegistry;
  private filterRegister: FilterRegistry;
  private settingCenter: SettingRegistry;
  private achievementResolver: AchievementResolver;
  private pressureRegistry: PressureRegistry;
  private worldRegistry: WorldRegistry;
  private traitRegistry: TraitRegistry;

  private playerRef: Player | null = null;
  private plugins: ModPlugin[] = [];
  private registeredScreens = new Map<string, ComponentType<any>>();
  private loadedMods: ResolvedMod[] = [];

  private incidentTriggerHooks: HookEntry[] = [];
  private incidentExecutedHooks: HookEntry[] = [];
  private playerUpdateHooks: HookEntry[] = [];
  private playerCreatedHooks: HookEntry[] = [];
  private yearHooks: HookEntry[] = [];
  private choiceHooks: HookEntry[] = [];
  private weightRuleSeq = 0;
  private weightRuleDisposers: Array<() => void> = [];

  constructor() {
    this.registry = inject(ModMonitor);
    this.eventTypeRegistry = inject(EventTypeRegistry);
    this.eventBus = inject(TypedEventBus);
    this.configStore = inject(ConfigStore);
    this.conditionReg = inject(LevelConditionRegistry);
    this.algoRegister = inject(AlgorithmRegistry);
    this.filterRegister = inject(FilterRegistry);
    this.settingCenter = inject(SettingRegistry);
    this.achievementResolver = inject(AchievementResolver);
    this.pressureRegistry = inject(PressureRegistry);
    this.worldRegistry = inject(WorldRegistry);
    this.traitRegistry = inject(TraitRegistry);
  }

  public setPlayer(p: Player): void {
    this.playerRef = p;
  }

  /** Load every enabled mod, in dependency order. Safe to call once. */
  public loadEnabled(): void {
    const enabled = this.configStore.getEnabledMods();
    const resolved = this.registry
      .getAllResolved()
      .filter((m) => enabled.includes(m.dirName));

    const { order, skipped } = resolveLoadOrder(resolved);
    for (const s of skipped) {
      console.warn(`[Mod] 跳过 "${s.dirName}": ${s.reason}`);
    }
    this.loadedMods = order;
    for (const mod of order) this.loadOne(mod);
  }

  /** Reload all enabled plugins. Sources are re-read from disk each time. */
  public reloadEnabled(): void {
    this.plugins = [];
    this.incidentTriggerHooks = [];
    this.incidentExecutedHooks = [];
    this.playerUpdateHooks = [];
    this.playerCreatedHooks = [];
    this.yearHooks = [];
    this.choiceHooks = [];
    // Drop the weight rules the previous load contributed, so a reload doesn't
    // stack duplicate multipliers.
    for (const dispose of this.weightRuleDisposers) dispose();
    this.weightRuleDisposers = [];
    // Also drop screens the previous load registered, or re-registration
    // accumulates duplicates on every reload.
    this.registeredScreens.clear();
    this.loadEnabled();
  }

  public getLoadedMods(): ResolvedMod[] {
    return this.loadedMods;
  }

  private loadOne(mod: ResolvedMod): void {
    const mainPath = join(this.registry.getModPath(mod.dirName), mod.manifest.main);
    let exported: any;
    try {
      const source = readFileSync(mainPath, "utf-8");
      exported = loadModModule(source, { filename: mainPath });
    } catch (err) {
      console.error(
        `[Mod] 加载 "${mod.dirName}" 失败:`,
        (err as Error).message,
      );
      return;
    }

    const plugin: ModPlugin = exported?.default ?? exported;
    if (!plugin || typeof plugin !== "object" || typeof plugin.id !== "string") {
      console.warn(`[Mod] "${mod.dirName}" 未导出合法的 ModPlugin（跳过）`);
      return;
    }

    const ctx = this.createContext(mod.dirName);
    // Capability-gated like every other API: event types need "events".
    const manifest = this.registry.getModManifest(mod.dirName) ?? {};
    if (hasCapability(manifest, "events")) {
      safe(`${mod.dirName}.registerEventTypes`, () =>
        plugin.registerEventTypes?.(this.eventTypeRegistry, ctx),
      );
    } else if (plugin.registerEventTypes) {
      console.warn(`[Mod] "${mod.dirName}" 未声明 "events" 能力，忽略 registerEventTypes`);
    }
    this.registerHooks(plugin, ctx, mod.dirName);
    safe(`${mod.dirName}.onInit`, () => plugin.hooks?.onInit?.(ctx));

    this.plugins.push(plugin);
    this.eventBus.emit("moder:loadSuccess", { modName: plugin.id });
  }

  private registerHooks(plugin: ModPlugin, ctx: ModContext, name: string): void {
    const h = plugin.hooks;
    if (!h) return;
    const bind = (fn: (...a: any[]) => any) => ({
      fn: fn.bind(plugin),
      ctx,
    });
    if (h.onIncidentTrigger) this.incidentTriggerHooks.push(bind(h.onIncidentTrigger));
    if (h.onIncidentExecuted) this.incidentExecutedHooks.push(bind(h.onIncidentExecuted));
    if (h.onPlayerUpdate) this.playerUpdateHooks.push(bind(h.onPlayerUpdate));
    if (h.onPlayerCreated) this.playerCreatedHooks.push(bind(h.onPlayerCreated));
    if (h.onYear) this.yearHooks.push(bind(h.onYear));
    if (h.onChoice) this.choiceHooks.push(bind(h.onChoice));
    void name;
  }

  // ── hook dispatch (each call error-isolated) ─────────────────
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
    for (const { fn, ctx } of this.yearHooks) {
      safe("onYear", () => fn(player, ctx));
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

  private createContext(modName: string): ModContext {
    // Capability gate: a mod only gets the powers its manifest declares.
    const manifest = this.registry.getModManifest(modName) ?? {};
    const can = (cap: Parameters<typeof hasCapability>[1]): boolean => {
      const ok = hasCapability(manifest, cap);
      if (!ok) {
        console.warn(`[Mod] "${modName}" 未声明 "${cap}" 能力，调用被拒绝`);
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
          `[Mod] "${modName}" ${label} 注册失败（可能重复）:`,
          (err as Error).message,
        );
      }
    };
    return {
      eventBus: this.eventBus,
      configStore: this.configStore,
      logger: {
        info: (msg) => noopLogger.info(`[${modName}] ${msg}`),
        warn: (msg) => noopLogger.warn(`[${modName}] ${msg}`),
        error: (msg) => noopLogger.error(`[${modName}] ${msg}`),
      },
      getPlayer: () => {
        if (!this.playerRef) throw new Error("Player 未初始化");
        return this.playerRef;
      },
      createEventClass: (def: ModEventClassDef) => {
        if (!can("events")) return this.makeEventClass({ apply: () => {} });
        return this.makeEventClass(def);
      },

      registerScreen: (key, entry) => {
        if (!can("ui")) return;
        this.registeredScreens.set(key, entry.component);
        const parent = (entry as { parent?: ComponentType<any> }).parent;
        reg(
          () => registerComponent(entry.component, {}, parent ? { parent } : undefined),
          "screen",
        );
      },
      navigateTo: (scene: string) => {
        if (!can("ui")) return;
        const target = this.registeredScreens.get(scene);
        if (!target) {
          console.warn(`[Mod] navigateTo: 未注册的屏幕 "${scene}"`);
          return;
        }
        gotoScreen(target, {});
      },
      addCondition: (id, ctor, schema) => {
        if (can("events")) reg(() => this.conditionReg.register(id, { ctor, schema }), "condition");
      },
      addAlgorithm: (name, factory) => {
        if (can("events")) reg(() => this.algoRegister.register(name, factory), "algorithm");
      },
      addFilter: (id, filter) => {
        if (can("events")) reg(() => this.filterRegister.register(id, filter), "filter");
      },
      addSetting: (key, entry) => {
        if (can("ui")) reg(() => this.settingCenter.register(key, entry), "setting");
      },
      registerAchievement: (achievement: Achievement) => {
        reg(() => this.achievementResolver.registerSingle(achievement), "achievement");
      },
      addPressureAxis: (def) => {
        if (!can("world")) return;
        if (!this.pressureRegistry.hasAxis(def.id)) {
          reg(() => this.pressureRegistry.registerAxis(def), "pressureAxis");
        }
      },
      addPressureRule: (rule) => {
        if (can("world")) reg(() => this.pressureRegistry.registerRule(rule), "pressureRule");
      },
      addLore: (def) => {
        if (can("world")) reg(() => this.worldRegistry.registerLore(def), "lore");
      },
      addFateArc: (def) => {
        if (can("world")) reg(() => this.worldRegistry.registerFate(def), "fate");
      },
      addWorldEvent: (def) => {
        if (can("world")) reg(() => this.worldRegistry.registerWorldEvent(def), "worldEvent");
      },
      addTrait: (def) => {
        if (!can("world")) return;
        if (!this.traitRegistry.has(def.id)) {
          reg(() => this.traitRegistry.register(def), "trait");
        }
      },
      // A per-mod forked stream: reproducible, and isolated from the main one.
      random: inject(RandomService).fork(modName),
      addWeightRule: (rule) => {
        const id = `mod:${modName}:rule${++this.weightRuleSeq}`;
        this.weightRuleDisposers.push(inject(EventDirector).addRule(id, rule));
      },
    };
  }

  private makeEventClass(
    def: ModEventClassDef,
  ): new (params: IncidentParameter) => Incident {
    return class ModDynamicEvent extends Incident {
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
}
