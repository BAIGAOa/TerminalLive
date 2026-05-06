import { Scope, Scoped } from "di-wise";
import IncidentFilter from "../IncidentFilter.js";

/**
 * 过滤器注册表。根据名称创建过滤器实例。
 * 目前所有过滤器都是无参构造函数，后续如果需要参数化，
 */
@Scoped(Scope.Container)
export default class FilterRegistry {
  private factories = new Map<string, () => IncidentFilter>();

  public register(name: string, factory: () => IncidentFilter): void {
    if (this.factories.has(name)) {
      throw new Error(`过滤器 "${name}" 已注册`);
    }
    this.factories.set(name, factory);
  }

  public create(name: string): IncidentFilter {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`未知过滤器: "${name}"`);
    }
    return factory();
  }

  public has(name: string): boolean {
    return this.factories.has(name);
  }
}
