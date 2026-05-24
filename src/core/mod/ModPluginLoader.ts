import { createRequire } from "node:module";
import { Scope, Scoped, inject } from "di-wise";
import EventTypeRegistry from "./EventTypeRegistry.js";
import ConfigStore from "../store/ConfigStore.js";
import Player from "../../world/Player.js";
import { Incident, IncidentParameter } from "../../world/Incident.js";
import { ModContext, ModPlugin, ModEventClassDef } from "./types.js";
import { registerComponent } from "@baigao_h/ink-kit";
import TypedEventBus from "../TypedEventBus.js";
import ModMonitor from "./ModMonitor.js";
import AlgorithmRegistry from "../registry/AlgorithmRegistry.js";
import FilterRegistry from "../registry/FilterRegistry.js";
import LevelConditionRegistry from "../registry/LevelConditionRegistry.js";
import { SettingRegistry } from "../registry/SettingRegistry.js";
import AchievementResolver from "../../achievement/AchievementResolver.js";
import { Achievement } from "../../achievement/AchievementDefinition.js";

interface HookEntry {
  fn: (...args: any[]) => any;
  ctx: ModContext;
}

@Scoped(Scope.Container)
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

  private playerRef: Player | null = null;
  private plugins: ModPlugin[] = [];

  private incidentTriggerHooks: HookEntry[] = [];
  private incidentExecutedHooks: HookEntry[] = [];
  private playerUpdateHooks: HookEntry[] = [];

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
  }

  public setPlayer(p: Player): void {
    this.playerRef = p;
  }

  public loadEnabled(): void {
    const enabled = this.configStore.getEnabledMods();
    for (const name of enabled) {
      if (!this.registry.isValid(name)) continue;
      const achPath = this.registry.getModAchievementsPath(name);
      this.achievementResolver.load(achPath);
      this.loadOne(name);
    }
  }

  public fireIncidentTrigger(incident: Incident, player: Player): boolean {
    for (const { fn, ctx } of this.incidentTriggerHooks) {
      if (fn(incident, player, ctx) === false) return false;
    }
    return true;
  }

  public fireIncidentExecuted(incident: Incident, player: Player): void {
    for (const { fn, ctx } of this.incidentExecutedHooks) {
      fn(incident, player, ctx);
    }
  }

  public firePlayerUpdate(player: Player): void {
    for (const { fn, ctx } of this.playerUpdateHooks) {
      fn(player, ctx);
    }
  }

  private loadOne(name: string): void {
    const mainPath = this.registry.getModMainPath(name);
    let requireFn: NodeRequire;
    try {
      requireFn = createRequire(mainPath);
    } catch {
      console.warn(`[Mod] 无法为 ${name} 创建 require 上下文`);
      return;
    }

    let exported: any;
    try {
      exported = requireFn(mainPath);
    } catch (err) {
      console.error(`[Mod] 加载 ${name} 失败:`, (err as Error).message);
      return;
    }

    const plugin: ModPlugin = exported.default ?? exported;
    if (
      !plugin ||
      typeof plugin !== "object" ||
      typeof plugin.id !== "string"
    ) {
      console.warn(`[Mod] ${name} 未导出合法的 ModPlugin`);
      return;
    }

    const ctx = this.createContext(name);

    try {
      plugin.registerEventTypes?.(this.eventTypeRegistry, ctx);
    } catch (err) {
      console.error(`[Mod] ${name} 注册事件类型失败:`, (err as Error).message);
    }

    this.registerHooks(plugin, ctx);

    try {
      plugin.hooks?.onInit?.(ctx);
    } catch (err) {
      console.error(`[Mod] ${name} onInit 失败:`, (err as Error).message);
    }

    this.plugins.push(plugin);
    this.eventBus.emit("moder:loadSuccess", { modName: name });
  }

  private registerHooks(plugin: ModPlugin, ctx: ModContext): void {
    const h = plugin.hooks;
    if (!h) return;

    if (h.onIncidentTrigger) {
      this.incidentTriggerHooks.push({
        fn: h.onIncidentTrigger.bind(plugin),
        ctx,
      });
    }
    if (h.onIncidentExecuted) {
      this.incidentExecutedHooks.push({
        fn: h.onIncidentExecuted.bind(plugin),
        ctx,
      });
    }
    if (h.onPlayerUpdate) {
      this.playerUpdateHooks.push({ fn: h.onPlayerUpdate.bind(plugin), ctx });
    }
  }

  private createContext(modName: string): ModContext {
    return {
      eventBus: this.eventBus,
      configStore: this.configStore,
      logger: {
        info: (msg) => console.log(`[${modName}] ${msg}`),
        warn: (msg) => console.warn(`[${modName}] ${msg}`),
        error: (msg) => console.error(`[${modName}] ${msg}`),
      },
      getPlayer: () => {
        if (!this.playerRef) throw new Error("Player 未初始化");
        return this.playerRef;
      },
      createEventClass: (def: ModEventClassDef) => this.makeEventClass(def),

      registerScreen: (_key: string, entry) => {
        registerComponent(entry.component, {}, {
          parent: entry.hide ? undefined : undefined,
        } as any);
      },
      navigateTo: (_scene: string) => {
        // ink-kit 屏幕导航由 useScreenSystem().gotoScreen 完成
        // 模组系统暂不支持通过字符串导航
        console.warn(`[Mod] navigateTo 在 ink-kit 模式下暂不支持字符串导航: ${_scene}`);
      },
      addCondition: (id, ctor, schema) => {
        this.conditionReg.register(id, { ctor, schema });
      },
      addAlgorithm: (name, factory) => {
        this.algoRegister.register(name, factory);
      },
      addFilter: (id, filter) => {
        this.filterRegister.register(id, filter);
      },
      addSetting: (key, entry) => {
        this.settingCenter.register(key, entry);
      },
      registerAchievement: (achievement: Achievement) => {
        this.achievementResolver.registerSingle(achievement);
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