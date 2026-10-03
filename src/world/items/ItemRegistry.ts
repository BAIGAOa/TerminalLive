import { ItemDefinition } from "./ItemDefinition.js";

export default class ItemRegistry {
  private defs = new Map<string, ItemDefinition>();

  public register(def: ItemDefinition): void {
    if (this.defs.has(def.id)) {
      throw new Error(`物品 ID 重复: ${def.id}`);
    }
    this.defs.set(def.id, def);
  }

  public get(id: string): ItemDefinition | undefined {
    return this.defs.get(id);
  }

  public has(id: string): boolean {
    return this.defs.has(id);
  }

  public getAll(): ItemDefinition[] {
    return Array.from(this.defs.values());
  }
}
