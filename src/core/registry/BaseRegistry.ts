export default class BaseRegistry<T> {
  protected entries: Map<string, T> = new Map();

  public register(key: string, value: T): void {
    if (this.entries.has(key)) {
      throw new Error(`key "${key}" 已注册，不可重复注册`);
    }
    this.entries.set(key, value);
  }

  /**
   * Insert or replace, returning whether it replaced something.
   *
   * Boot-time content uses `register`, where a duplicate key is a bug worth
   * catching. Plugins use `set`: replacing a built-in registration is the whole
   * point of the extension model, so it is allowed — and the caller logs it.
   */
  public set(key: string, value: T): boolean {
    const replaced = this.entries.has(key);
    this.entries.set(key, value);
    return replaced;
  }

  public unregister(key: string): void {
    if (!this.entries.has(key)) {
      throw new Error(`key "${key}" 不存在，无法删除`);
    }
    this.entries.delete(key);
  }

  public get(key: string): T {
    const value = this.entries.get(key);
    if (value === undefined) {
      throw new Error(`key "${key}" 不存在`);
    }
    return value;
  }

  /** Non-throwing lookup for render paths: an unknown id must not crash the UI. */
  public tryGet(key: string): T | undefined {
    return this.entries.get(key);
  }

  public has(key: string): boolean {
    return this.entries.has(key);
  }

  public getAll(): T[] {
    return Array.from(this.entries.values());
  }

  public getKeys(): string[] {
    return Array.from(this.entries.keys());
  }

  public getCount(): number {
    return this.entries.size;
  }

  public filter(predicate: (value: T, key: string) => boolean): T[] {
    const result: T[] = [];
    for (const [key, value] of this.entries) {
      if (predicate(value, key)) {
        result.push(value);
      }
    }
    return result;
  }

  /** Read-only view — callers must not mutate registry internals directly. */
  public getMap(): ReadonlyMap<string, T> {
    return this.entries;
  }
}
