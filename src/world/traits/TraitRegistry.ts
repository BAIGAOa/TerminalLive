import { TraitDefinition } from "./TraitDefinition.js";

export default class TraitRegistry {
  private defs = new Map<string, TraitDefinition>();

  public register(def: TraitDefinition): void {
    if (this.defs.has(def.id)) {
      throw new Error(`天赋 ID 重复: ${def.id}`);
    }
    this.defs.set(def.id, def);
  }

  public get(id: string): TraitDefinition | undefined {
    return this.defs.get(id);
  }

  public has(id: string): boolean {
    return this.defs.has(id);
  }

  public getAll(): TraitDefinition[] {
    return Array.from(this.defs.values());
  }
}
