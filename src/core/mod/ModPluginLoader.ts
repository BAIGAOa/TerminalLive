import { createRequire } from "node:module";
import { Scope, Scoped, inject } from "di-wise";
import ModRegistry from "./ModRegistry.js";
import EventTypeRegistry from "./EventTypeRegistry.js";
import EventBus from "../EventBus.js";
import ConfigStore from "../store/ConfigStore.js";
import Player from "../../world/Player.js";
import { Incident, IncidentParameter } from "../../world/Incident.js";
import { ModContext, ModPlugin, ModEventClassDef } from "./types.js";
import { ScreenRegistry } from "../store/ScreenRegistry.js";
import { container } from "../../Container.js";
import ScreenStore from "../store/ScreenStore.js";

// 单个钩子函数的存储条目，包含函数本身和它绑定的 ModContext
interface HookEntry {
  fn: (...args: any[]) => any;
  ctx: ModContext;
}

// 标注为容器级作用域，整个应用共享同一个实例
@Scoped(Scope.Container)
export default class ModPluginLoader {
  // 模组注册表，管理所有可用模组的元数据
  private registry: ModRegistry;
  // 事件类型注册表，供模组注册自定义事件类
  private eventTypeRegistry: EventTypeRegistry;
  // 全局事件总线
  private eventBus: EventBus;
  // 持久化配置存储
  private configStore: ConfigStore;
  private screenRegistry: ScreenRegistry;

  // 当前玩家引用，由外部调用 setPlayer 注入
  private playerRef: Player | null = null;
  // 已加载的插件对象列表
  private plugins: ModPlugin[] = [];

  // 各类生命周期钩子队列
  private incidentTriggerHooks: HookEntry[] = []; // 事件触发前
  private incidentExecutedHooks: HookEntry[] = []; // 事件执行后
  private playerUpdateHooks: HookEntry[] = []; // 玩家每回合更新

  constructor() {
    this.registry = inject(ModRegistry);
    this.eventTypeRegistry = inject(EventTypeRegistry);
    this.eventBus = inject(EventBus);
    this.configStore = inject(ConfigStore);
    this.screenRegistry = inject(ScreenRegistry);
  }

  // 设置当前玩家对象，供模组上下文中的 getPlayer 使用
  public setPlayer(p: Player): void {
    this.playerRef = p;
  }

  // 加载所有配置中启用的模组
  public loadEnabled(): void {
    const enabled = this.configStore.getEnabledMods();
    for (const name of enabled) {
      // 检查模组是否在注册表中存在且合法
      if (!this.registry.isValid(name)) continue;
      this.loadOne(name);
    }
  }

  // 触发事件前钩子，遍历所有注册的 onIncidentTrigger
  // 如果任一钩子显式返回 false，则阻止事件执行
  public fireIncidentTrigger(incident: Incident, player: Player): boolean {
    for (const { fn, ctx } of this.incidentTriggerHooks) {
      if (fn(incident, player, ctx) === false) return false;
    }
    return true;
  }

  // 触发事件执行后钩子
  public fireIncidentExecuted(incident: Incident, player: Player): void {
    for (const { fn, ctx } of this.incidentExecutedHooks) {
      fn(incident, player, ctx);
    }
  }

  // 触发玩家更新后钩子
  public firePlayerUpdate(player: Player): void {
    for (const { fn, ctx } of this.playerUpdateHooks) {
      fn(player, ctx);
    }
  }

  // 加载单个模组： require 入口文件 → 构造上下文 → 注册事件类型 → 注册钩子 → 调用 onInit
  private loadOne(name: string): void {
    const mainPath = this.registry.getModMainPath(name);
    let requireFn: NodeRequire;
    try {
      // 以模组文件所在目录为基准创建 require 函数，使其能加载自身依赖
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

    // 支持 ES 模块默认导出和 CommonJS 整体导出
    const plugin: ModPlugin = exported.default ?? exported;
    if (
      !plugin ||
      typeof plugin !== "object" ||
      typeof plugin.id !== "string"
    ) {
      console.warn(`[Mod] ${name} 未导出合法的 ModPlugin`);
      return;
    }

    // 创建该模组专属的 ModContext
    const ctx = this.createContext(name);

    // 调用模组的注册事件类型函数（如果有）
    try {
      plugin.registerEventTypes?.(this.eventTypeRegistry, ctx);
    } catch (err) {
      console.error(`[Mod] ${name} 注册事件类型失败:`, (err as Error).message);
    }

    // 将模组提供的钩子注册到对应队列
    this.registerHooks(plugin, ctx);

    // 执行模组的初始化钩子
    try {
      plugin.hooks?.onInit?.(ctx);
    } catch (err) {
      console.error(`[Mod] ${name} onInit 失败:`, (err as Error).message);
    }

    this.plugins.push(plugin);
    this.eventBus.emit("moder:loadSuccess", { modName: name });
  }

  // 遍历 ModHooks，将存在的钩子函数绑定并推入对应队列
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

  // 根据模组名称创建 ModContext，提供事件总线、配置、日志、玩家引用和事件类工厂
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
      // 动态创建 Incident 子类，使用传入的 ModEventClassDef 作为行为定义
      createEventClass: (def: ModEventClassDef) => this.makeEventClass(def),

      registerScreen: (entry) => {
        this.screenRegistry.register({
          scene: entry.scene,
          component: entry.component,
          nameKey: entry.nameKey,
          highlightId: entry.highlightId ?? entry.scene,
        });
      },
      navigateTo: (scene) => {
        container.resolve(ScreenStore).setScene(scene);
      },
    };
  }

  // 根据 ModEventClassDef 生成一个继承自 Incident 的动态类
  private makeEventClass(
    def: ModEventClassDef,
  ): new (params: IncidentParameter) => Incident {
    return class ModDynamicEvent extends Incident {
      constructor(params: IncidentParameter) {
        super(params);
      }
      // 事件触发时调用模组定义的 apply
      apply(player: Player): void {
        def.apply(player, this);
      }
      // 计算权重时优先使用模组自定义 getWeight，否则回退到基类 weight 属性
      getWeight(player: Player): number {
        return def.getWeight?.(player, this) ?? this.weight;
      }
    };
  }
}
