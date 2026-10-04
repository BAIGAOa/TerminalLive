import { CareerDefinition } from "./CareerDefinition.js";

export default class CareerRegistry {
  private defs = new Map<string, CareerDefinition>();

  public register(def: CareerDefinition): void {
    if (this.defs.has(def.id)) {
      throw new Error(`职业 ID 重复: ${def.id}`);
    }
    this.defs.set(def.id, def);
  }

  public get(id: string): CareerDefinition | undefined {
    return this.defs.get(id);
  }

  public has(id: string): boolean {
    return this.defs.has(id);
  }

  public getAll(): CareerDefinition[] {
    return Array.from(this.defs.values());
  }
}
