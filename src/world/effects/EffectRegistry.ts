import { EffectDefinition } from "./EffectDefinition.js";

export default class EffectRegistry {
  private defs = new Map<string, EffectDefinition>();

  public register(def: EffectDefinition): void {
    if (this.defs.has(def.id)) {
      throw new Error(`效果 ID 重复: ${def.id}`);
    }
    this.defs.set(def.id, def);
  }

  public get(id: string): EffectDefinition | undefined {
    return this.defs.get(id);
  }

  public has(id: string): boolean {
    return this.defs.has(id);
  }

  public getAll(): EffectDefinition[] {
    return Array.from(this.defs.values());
  }
}
