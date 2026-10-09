/**
 * The inter-plugin service registry.
 *
 * A microkernel is only worth the name if plugins can extend *each other*, not
 * just the core. A plugin publishes a small interface under an id; any plugin
 * that depends on it (see manifest `dependencies`) resolves it back. The kernel
 * never learns what the interface means — that is the point.
 *
 * Ownership is tracked so unloading a plugin retracts exactly its own services
 * and leaves other publishers' alone.
 */
export interface PluginServices {
  /** Publish `impl` under `id`. The last publisher of an id wins. */
  provide<T>(id: string, impl: T): void;
  /** Withdraw a service this plugin published. */
  retract(id: string): void;
  /** Resolve a service, or `undefined` when nobody provides it. */
  get<T>(id: string): T | undefined;
  /**
   * Resolve a service or throw. Use for hard dependencies: a plugin that
   * declared `dependencies: {"other": "*"}` should fail loudly, not silently,
   * when the other plugin is disabled.
   */
  require<T>(id: string): T;
  /** Whether anyone provides `id`. */
  has(id: string): boolean;
  /** Every provided service id. */
  ids(): string[];
}

/** The kernel's registry: one instance shared by every plugin handle. */
export class ServiceRegistry {
  /**
   * One stack of publications per service id.
   *
   * A stack, not a single value: two plugins may publish the same id, and when
   * the one that published last unloads, the other's implementation has to
   * resurface. Keeping only the winning value would leave everyone resolving
   * the unloaded plugin's closure.
   */
  private impls = new Map<string, Array<{ owner: string; value: unknown }>>();

  public provide<T>(id: string, impl: T, owner: string): void {
    const stack = (this.impls.get(id) ?? []).filter((p) => p.owner !== owner);
    stack.push({ owner, value: impl });
    this.impls.set(id, stack);
  }

  public retract(id: string, owner: string): void {
    const stack = this.impls.get(id);
    if (!stack) return;
    const next = stack.filter((p) => p.owner !== owner);
    if (next.length === stack.length) return; // this plugin did not publish it
    if (next.length) this.impls.set(id, next);
    else this.impls.delete(id);
  }

  /** Drop everything `owner` published. Called when a plugin unloads. */
  public retractAll(owner: string): void {
    for (const id of [...this.impls.keys()]) this.retract(id, owner);
  }

  public get<T>(id: string): T | undefined {
    const stack = this.impls.get(id);
    return stack?.[stack.length - 1]?.value as T | undefined;
  }

  public has(id: string): boolean {
    return this.impls.has(id);
  }

  public ids(): string[] {
    return [...this.impls.keys()];
  }

  /** The handle a single plugin receives, with ownership baked in. */
  public forOwner(owner: string): PluginServices {
    return {
      provide: <T>(id: string, impl: T) => this.provide(id, impl, owner),
      retract: (id: string) => this.retract(id, owner),
      get: <T>(id: string) => this.get<T>(id),
      require: <T>(id: string) => {
        const impl = this.get<T>(id);
        if (impl === undefined) {
          throw new Error(
            `插件 "${owner}" 依赖的服务 "${id}" 未提供（提供方未启用或加载失败）`,
          );
        }
        return impl;
      },
      has: (id: string) => this.has(id),
      ids: () => this.ids(),
    };
  }
}
