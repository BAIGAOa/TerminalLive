import { Incident, IncidentParameter } from "../../world/Incident.js";


export type IncidentConstructor = new (params: IncidentParameter) => Incident;

export default class EventTypeRegistry {
  private readonly types = new Map<string, IncidentConstructor>();

  //注册事件类型
  public register(name: string, ctor: IncidentConstructor): void {
    if (this.types.has(name)) {
      throw new Error(`事件类型 "${name}" 已注册`);
    }
    this.types.set(name, ctor);
  }

  //创建事件实例
  public create(name: string, params: IncidentParameter): Incident {
    const ctor = this.types.get(name);
    if (!ctor) {
      throw new Error(`未知事件类型: "${name}"`);
    }
    return new ctor(params);
  }

  /**
   * Forget a type. Idempotent, because it runs on the unload path: a plugin
   * being torn down must not fail because its type was already gone.
   *
   * Without this a hot reload cannot replace a plugin's event class — the
   * re-registration throws as a duplicate, the error is isolated, and the
   * freshly-edited class is silently discarded in favour of the stale one.
   */
  public unregister(name: string): void {
    this.types.delete(name);
  }

  //检查事件类型是否存在
  public has(name: string): boolean {
    return this.types.has(name);
  }
}