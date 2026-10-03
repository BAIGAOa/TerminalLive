type Constructor<T> = new () => T;

/**
 * Minimal lazy singleton container — replaces the `di-wise` dependency.
 *
 * Services are plain classes with no-argument constructors that pull their own
 * dependencies via {@link inject}. The first `resolve` constructs and caches
 * the instance; later calls return the cached one.
 */
class Container {
  private instances = new Map<Constructor<unknown>, unknown>();
  private building = new Set<Constructor<unknown>>();

  public resolve<T>(Ctor: Constructor<T>): T {
    if (this.instances.has(Ctor)) return this.instances.get(Ctor) as T;
    if (this.building.has(Ctor)) {
      throw new Error(
        `[container] circular dependency while building ${Ctor.name}`,
      );
    }
    this.building.add(Ctor);
    try {
      const instance = new Ctor();
      this.instances.set(Ctor, instance);
      return instance;
    } finally {
      this.building.delete(Ctor);
    }
  }

  /** Register a pre-built instance (rarely needed). */
  public register<T>(Ctor: Constructor<T>, instance: T): void {
    this.instances.set(Ctor, instance);
  }
}

export const container = new Container();

/** Resolve a dependency from the container (the old di-wise `inject`). */
export function inject<T>(Ctor: Constructor<T>): T {
  return container.resolve(Ctor);
}
