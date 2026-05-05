import { Scope, Scoped } from "di-wise";
import { IEventAlgorithm } from "../event/IEventAlgorithm.js";
import EventCenter from "../event/EventCenter.js";
import EventHistory from "../event/EventHistory.js";
import LogStore from "../core/store/LogStore.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";
import IncidentFilter from "./IncidentFilter.js";

/** 算法工厂接收关卡级依赖，返回算法实例 */
export type AlgorithmFactory = (deps: {
  eventCenter: EventCenter;
  logStore: LogStore;
  eventHistory: EventHistory;
  modPluginLoader: ModPluginLoader;
  filters?: IncidentFilter[];
}) => IEventAlgorithm;

@Scoped(Scope.Container)
export default class AlgorithmRegistry {
  private factories = new Map<string, AlgorithmFactory>();

  /** 注册算法（内置算法在启动时注册，模组也可以通过 ctx 注册） */
  public register(name: string, factory: AlgorithmFactory): void {
    if (this.factories.has(name)) {
      throw new Error(`算法 "${name}" 已注册`);
    }
    this.factories.set(name, factory);
  }

  /** 获取算法工厂 */
  public get(name: string): AlgorithmFactory {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`未知算法: "${name}"`);
    return factory;
  }

  /** 检查算法是否存在 */
  public has(name: string): boolean {
    return this.factories.has(name);
  }
}
