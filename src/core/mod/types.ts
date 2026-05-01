import type Player from "../../world/Player.js";
import type { Incident, IncidentParameter } from "../../world/Incident.js";
import type EventTypeRegistry from "./EventTypeRegistry.js";
import type EventBus from "../EventBus.js";
import type ConfigStore from "../store/ConfigStore.js";


export interface ModManifest {
  // 模组名称（唯一标识）
  name: string;
  // 版本号
  version?: string;
  // 简短描述
  description?: string;
  // 入口文件路径，指向实现 ModPlugin 的模块
  main: string;
  // 作者
  author?: string;
}

// 模组日志接口
export interface ModLogger {
  // 普通信息日志
  info(msg: string): void;
  // 警告日志
  warn(msg: string): void;
  // 错误日志
  error(msg: string): void;
}

// 模组上下文，游戏运行时注入给模组，供模组与游戏核心交互
export interface ModContext {
  // 事件总线，可监听或派发自定义事件
  eventBus: EventBus;
  // 配置存储，可读写模组的持久化配置
  configStore: ConfigStore;
  // 日志工具
  logger: ModLogger;
  // 获取当前玩家对象
  getPlayer: () => Player;
  /**
   * 基于给定的 ModEventClassDef 动态创建 Incident 子类。
   * 传入的 def.apply 会作为事件的执行逻辑，def.getWeight 可选地影响随机权重。
   */
  createEventClass: (def: ModEventClassDef) => new (params: IncidentParameter) => Incident;
  /**
   * 注册自定义 UI 场景。场景 ID 任意字符串，不与内置冲突即可。
   * 注册后可通过 navigateTo 跳转，或绑定按键触发 setScene。
   */
  registerScreen: (entry: {
    scene: string;
    component: React.ComponentType<any>;
    nameKey: string;
    highlightId?: string;
  }) => void;
  /** 导航到任意场景 */
  navigateTo: (scene: string) => void;
}

// 模组自定义事件类的行为描述
export interface ModEventClassDef {
  // 事件触发时执行的效果，self 为当前事件实例
  apply: (player: Player, self: Incident) => void;
  // 可选权重计算，用于在随机池中调整该事件被选中的概率
  getWeight?: (player: Player, self: Incident) => number;
}

// 模组可选的钩子函数集合，插入到游戏的不同生命周期节点
export interface ModHooks {
  // 模组初始化时调用，可执行异步操作（如加载资源）
  onInit?: (ctx: ModContext) => void | Promise<void>;
  // 玩家对象创建后调用
  onPlayerCreated?: (player: Player, ctx: ModContext) => void;
  // 每帧/每次玩家更新时调用
  onPlayerUpdate?: (player: Player, ctx: ModContext) => void;
  /**
   * 事件触发前调用。
   * 返回 false 可阻止该事件继续执行。
   */
  onIncidentTrigger?: (incident: Incident, player: Player, ctx: ModContext) => boolean | void;
  // 事件执行完成后调用
  onIncidentExecuted?: (incident: Incident, player: Player, ctx: ModContext) => void;
}

// 模组必须导出的插件对象，作为与游戏系统交互的唯一入口
export interface ModPlugin {
  // 模组唯一标识
  id: string;
  // 注册自定义事件类型到全局注册表
  registerEventTypes?: (registry: EventTypeRegistry, ctx: ModContext) => void;
  // 生命周期钩子函数集
  hooks?: ModHooks;
}