import type Player from "../../world/Player.js";
import type { Incident, IncidentParameter } from "../../world/Incident.js";
import type EventTypeRegistry from "./EventTypeRegistry.js";
import type ConfigStore from "../store/ConfigStore.js";
import z from "zod";
import { AlgorithmFactory } from "../../event/AlgorithmRegistry.js";
import IncidentFilter from "../../event/IncidentFilter.js";
import TypedEventBus from "../TypedEventBus.js";

// 模组清单（mod.json）。这些字段会被 ModRegistry 读取，目前主要用于信息展示。
export interface ModManifest {
  name: string;
  version?: string;
  description?: string;
  // 入口文件路径，指向实现了 ModPlugin 的模块
  main: string;
  author?: string;
}

// 简单的日志接口，模组不需要直接接触 console。
// 好处是未来可以改日志输出方式（比如写文件），模组代码不用动。
export interface ModLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// 模组上下文：游戏核心提供给模组的"工具箱"。
// 每个模组拿到的是独立的上下文实例吗？不是，目前是共享的。
// 但通过闭包捕获了 modName，所以 logger 和事件命名空间是隔离的。
// 这个上下文是模组与游戏交互的唯一渠道——模组看不到 DI 容器，看不到文件系统，
// 只能通过这里的 API 来读写状态或注册内容。这是一种有意为之的限制。
export interface ModContext {
  eventBus: TypedEventBus;
  configStore: ConfigStore;
  logger: ModLogger;
  // 获取当前玩家。写成函数而不是直接给引用，是因为 Player 实例可能被替换（比如加载存档后）
  getPlayer: () => Player;
  // 动态创建事件类：模组不用自己写 class extends Incident，
  // 只需要提供 apply 和可选的 getWeight，框架帮你生成。
  createEventClass: (
    def: ModEventClassDef,
  ) => new (params: IncidentParameter) => Incident;
  // 注册自定义 UI 界面，和核心 ScreenRegistry 共享同一张表
  registerScreen: (entry: {
    scene: string;
    component: React.ComponentType<any>;
    nameKey: string;
    hide?: boolean;
    highlightId?: string;
  }) => void;
  navigateTo: (scene: string) => void;
  addCondition: (
    id: string,
    ctor: new (...args: any[]) => any,
    schema: z.ZodTypeAny,
  ) => void;
  addAlgorithm: (name: string, factory: AlgorithmFactory) => void;
  addFilter: (id: string, filter: () => IncidentFilter) => void;
}

// 模组自定义事件的行为描述。
// 不直接让模组写类是为了降低门槛——传两个函数比搞懂继承链简单多了。
export interface ModEventClassDef {
  apply: (player: Player, self: Incident) => void;
  getWeight?: (player: Player, self: Incident) => number;
}

// 生命周期钩子集合。
// 全部可选：一个模组可以只监听玩家更新，也可以只拦截事件触发，按需实现。
// 钩子按注册顺序调用，不存在优先级机制——先加载的模组先执行。
export interface ModHooks {
  onInit?: (ctx: ModContext) => void | Promise<void>;
  onPlayerCreated?: (player: Player, ctx: ModContext) => void;
  onPlayerUpdate?: (player: Player, ctx: ModContext) => void;
  // onIncidentTrigger 返回 false 可以阻止事件。这是模组最强大的干预能力，
  // 也是唯一能"否决"核心逻辑的钩子。用 void | boolean 的设计是为了让模组在不关心时直接无返回值。
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

// 模组必须导出的插件对象。
// id 是唯一标识，用于日志和存档中的 mod 列表。
export interface ModPlugin {
  id: string;
  registerEventTypes?: (registry: EventTypeRegistry, ctx: ModContext) => void;
  hooks?: ModHooks;
}
