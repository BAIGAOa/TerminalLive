import { ActionDefinition } from "./ActionDefinition.js";

export default class ActionRegistry {
  private defs = new Map<string, ActionDefinition>();

  public register(def: ActionDefinition): void {
    if (this.defs.has(def.id)) {
      throw new Error(`行动 ID 重复: ${def.id}`);
    }
    this.defs.set(def.id, def);
  }

  public get(id: string): ActionDefinition | undefined {
    return this.defs.get(id);
  }

  public has(id: string): boolean {
    return this.defs.has(id);
  }

  public getAll(): ActionDefinition[] {
    return Array.from(this.defs.values());
  }
}
