import { NpcDefinition } from "./NpcDefinition.js";

export default class NpcRegistry {
  private defs = new Map<string, NpcDefinition>();

  public register(def: NpcDefinition): void {
    if (this.defs.has(def.id)) {
      throw new Error(`NPC ID 重复: ${def.id}`);
    }
    this.defs.set(def.id, def);
  }

  public get(id: string): NpcDefinition | undefined {
    return this.defs.get(id);
  }

  public has(id: string): boolean {
    return this.defs.has(id);
  }

  public getAll(): NpcDefinition[] {
    return Array.from(this.defs.values());
  }
}
