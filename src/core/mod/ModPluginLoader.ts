import { createRequire } from "node:module";
import { Scope, Scoped, inject } from "di-wise";
import ModRegistry from "./ModRegistry.js";
import EventTypeRegistry from "./EventTypeRegistry.js";
import ConfigStore from "../store/ConfigStore.js";
import Player from "../../world/Player.js";
import { Incident, IncidentParameter } from "../../world/Incident.js";
import { ModContext, ModPlugin, ModEventClassDef } from "./types.js";
import { ScreenRegistry } from "../store/ScreenRegistry.js";
import { container } from "../../Container.js";
import ScreenStore from "../store/ScreenStore.js";
import LevelConditionRegistry from "../../level/registry/LevelConditionRegistry.js";
import AlgorithmRegistry from "../../event/AlgorithmRegistry.js";
import FilterRegistry from "../../event/registry/FilterRegistry.js";
import TypedEventBus from "../TypedEventBus.js";

// 每个钩子条目同时存函数和上下文：fireXxx 方法需要把 ctx 传回给模组的钩子函数。
// 函数用 bind 绑定了 plugin，这样模组作者写 this.xxx 时，this 指向自己的插件对象。
interface HookEntry {
  fn: (...args: any[]) => any;
  ctx: ModContext;
}

// 模组插件加载器：负责加载模组的 JS 入口文件，构造上下文，注册钩子和事件类型。
// 它是模组系统和游戏核心之间的桥梁——EventAlgorithm、Game 等核心模块通过它来
// 触发模组钩子，而不需要直接知道任何模组的存在。
@Scoped(Scope.Container)
export default class ModPluginLoader {
  private registry: ModRegistry;
  private eventTypeRegistry: EventTypeRegistry;
  private eventBus: TypedEventBus;
  private configStore: ConfigStore;
  private screenRegistry: ScreenRegistry;
  private conditionReg: LevelConditionRegistry;
  private algoRegister: AlgorithmRegistry;
  private filterRegister: FilterRegistry;

  // 玩家引用由外部注入——Player 的生命周期由 GameInitialization 管理，
  // 可能在加载存档时被整体替换，所以这里只存引用而不是持有。
  private playerRef: Player | null = null;
  private plugins: ModPlugin[] = [];

  // 三种钩子队列分开存，这样 fire 时不需要遍历所有钩子再判断类型。
  // 大多数回合没有事件触发，分开存意味着 playerUpdateHooks 的遍历不会经过事件钩子的空检查。
  private incidentTriggerHooks: HookEntry[] = [];
  private incidentExecutedHooks: HookEntry[] = [];
  private playerUpdateHooks: HookEntry[] = [];

  constructor() {
    this.registry = inject(ModRegistry);
    this.eventTypeRegistry = inject(EventTypeRegistry);
    this.eventBus = inject(TypedEventBus);
    this.configStore = inject(ConfigStore);
    this.screenRegistry = inject(ScreenRegistry);
    this.conditionReg = inject(LevelConditionRegistry);
    this.algoRegister = inject(AlgorithmRegistry);
    this.filterRegister = inject(FilterRegistry);
  }

  public setPlayer(p: Player): void {
    this.playerRef = p;
  }

  // 只加载用户在配置中勾选启用的模组，不会把 ~/.mod_live/ 下的所有东西都拉进来。
  // 这样用户可以在模组管理界面开关模组，不需要手动删文件夹。
  public loadEnabled(): void {
    const enabled = this.configStore.getEnabledMods();
    for (const name of enabled) {
      if (!this.registry.isValid(name)) continue;
      this.loadOne(name);
    }
  }

  // 遍历所有模组的 onIncidentTrigger 钩子。
  // 任意一个钩子返回 false 就阻止事件——这是一种"一票否决"机制。
  // 这样模组可以在某些条件下拦截事件。
  public fireIncidentTrigger(incident: Incident, player: Player): boolean {
    for (const { fn, ctx } of this.incidentTriggerHooks) {
      if (fn(incident, player, ctx) === false) return false;
    }
    return true;
  }

  // onIncidentExecuted 是纯通知，不关心返回值。
  // 适合用来做日志、统计、或者触发额外的副作用。
  public fireIncidentExecuted(incident: Incident, player: Player): void {
    for (const { fn, ctx } of this.incidentExecutedHooks) {
      fn(incident, player, ctx);
    }
  }

  // 每回合玩家更新后调用，给模组一个"巡视"玩家状态的机会。
  public firePlayerUpdate(player: Player): void {
    for (const { fn, ctx } of this.playerUpdateHooks) {
      fn(player, ctx);
    }
  }

  // 加载单个模组的完整流程：
  // require 入口 → 校验导出 → 构建上下文 → 注册事件类型 → 注册钩子 → 调用 onInit
  // 每一步都独立 try/catch，防止一个模组的错误影响其他模组或游戏启动。
  private loadOne(name: string): void {
    const mainPath = this.registry.getModMainPath(name);
    let requireFn: NodeRequire;
    try {
      // 用 createRequire 而不是全局 require：模组可能需要加载自己的 node_modules，
      // 从模组目录起算模块路径才能正确解析依赖。
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

    // 兼容 ES module 的 default 导出和 CommonJS 的 module.exports
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
      // onInit 可以是异步的，但这里用了 fire-and-forget——不等它完成。
      // 这意味着 onInit 中的异步操作（比如加载远程资源）不会阻塞游戏启动，
      // 但也意味着模组初始化的顺序不可靠。
      plugin.hooks?.onInit?.(ctx);
    } catch (err) {
      console.error(`[Mod] ${name} onInit 失败:`, (err as Error).message);
    }

    this.plugins.push(plugin);
    this.eventBus.emit("moder:loadSuccess", { modName: name });
  }

  // 把钩子函数 bind 到 plugin 实例上，再存入对应队列。
  // bind 让模组作者可以在钩子函数里用 this 访问自己插件对象的其他属性和方法。
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

  // 构建 ModContext。每个模组拿到的 ctx 共享底层对象（eventBus、configStore 等），
  // 但 logger 前缀是独立的，这样控制台输出能区分是哪个模组在说话。
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

      registerScreen: (entry) => {
        this.screenRegistry.register({
          scene: entry.scene,
          component: entry.component,
          nameKey: entry.nameKey,
          hide: entry.hide,
          highlightId: entry.highlightId ?? entry.scene,
        });
      },
      navigateTo: (scene) => {
        container.resolve(ScreenStore).setScene(scene);
      },
      addCondition: (id, ctor, schema) => {
        this.conditionReg.addCondition(id, ctor, schema);
      },
      addAlgorithm: (name, factory) => {
        this.algoRegister.register(name, factory);
      },
      addFilter: (id, filter) => {
        this.filterRegister.register(id, filter);
      },
    };
  }

  // 动态生成 Incident 子类。
  // 模组只需传入 apply 和 getWeight 两个函数，框架帮你搞定构造函数、setup 等样板代码。
  // 返回的是一个构造函数，可以直接传给 registry.register()。
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
      // getWeight 如果没提供就回退到基类的 this.weight（即 JSON 里配的那个数字）。
      // 这种设计让简单的"固定权重"事件和复杂的"按玩家状态动态权重"事件都能用同一套 API。
      getWeight(player: Player): number {
        return def.getWeight?.(player, this) ?? this.weight;
      }
    };
  }
}
