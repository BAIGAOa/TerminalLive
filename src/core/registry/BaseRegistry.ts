export default class BaseRegistry<T> {
  protected entries: Map<string, T> = new Map();

  public register(key: string, value: T): void {
    if (this.entries.has(key)) {
      throw new Error(`key "${key}" 已注册，不可重复注册`);
    }
    this.entries.set(key, value);
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

  public getMap() {
    return this.entries;
  }
}
