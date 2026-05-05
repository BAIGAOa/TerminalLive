import { Scope, Scoped } from "di-wise";

// 条件事件处理器：void 事件对应无参回调
type EventHandler<T> = T extends void ? () => void : (payload: T) => void;

@Scoped(Scope.Container)
export default class TypedEventBus {
  private listeners = new Map<string, Set<Function>>();

  public on<K extends keyof EventMap>(
    event: K,
    listener: EventHandler<EventMap[K]>,
  ) {
    const key = event as string;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(listener);
    return () => this.off(event, listener);
  }

  public off<K extends keyof EventMap>(
    event: K,
    listener: EventHandler<EventMap[K]>,
  ) {
    this.listeners.get(event as string)?.delete(listener);
  }

  public emit<K extends keyof EventMap>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [payload: EventMap[K]]
  ): void {
    const handlers = this.listeners.get(event as string);
    if (!handlers) return;
    const payload = args[0]; // 如果是 void，此处为 undefined
    handlers.forEach((fn) => {
      // 为了类型准确，void 事件直接调用 fn()
      if (args.length === 0) {
        (fn as () => void)();
      } else {
        fn(payload);
      }
    });
  }

  public once<K extends keyof EventMap>(
    event: K,
    listener: EventHandler<EventMap[K]>,
  ) {
    const wrapper = ((payload?: EventMap[K]) => {
      this.off(event, wrapper as any);
      listener(payload as any);
    }) as EventHandler<EventMap[K]>;
    return this.on(event, wrapper);
  }

  public clear(event?: keyof EventMap) {
    if (event) this.listeners.delete(event as string);
    else this.listeners.clear();
  }
}
