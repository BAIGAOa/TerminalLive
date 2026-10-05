import { inject } from "../../Container.js";
import type { NpcDefinition } from "./NpcDefinition.js";
import { Npc } from "./Npc.js";
import NpcTypeRegistry from "./NpcTypeRegistry.js";
import NpcTypes from "./NpcTypes.js";

/**
 * Holds the resolved NPC archetype instances. `register` accepts either a raw
 * {@link NpcDefinition} (from JSON) or a pre-built {@link Npc}; a raw def is
 * wrapped into the archetype its `type` (or role) selects, so every consumer
 * reads behaviour-capable `Npc` objects without knowing about the registry.
 */
export default class NpcRegistry {
  private defs = new Map<string, Npc>();
  private types: NpcTypeRegistry;

  constructor() {
    this.types = inject(NpcTypeRegistry);
    // Ensure built-ins exist even when a registry is constructed standalone
    // (e.g. in tests) before NpcTypes.registerAll() has run.
    NpcTypes.registerAll();
  }

  public register(def: NpcDefinition | Npc): void {
    const npc = def instanceof Npc ? def.init() : this.types.createForDef(def);
    if (this.defs.has(npc.id)) {
      throw new Error(`NPC ID 重复: ${npc.id}`);
    }
    this.defs.set(npc.id, npc);
  }

  public get(id: string): Npc | undefined {
    return this.defs.get(id);
  }

  public has(id: string): boolean {
    return this.defs.has(id);
  }

  public getAll(): Npc[] {
    return Array.from(this.defs.values());
  }

  // ── resettable (World content layering) ────────────────────────
  public snapshot(): Array<[string, Npc]> {
    return [...this.defs.entries()];
  }

  public restore(entries: Array<[string, Npc]>): void {
    this.defs = new Map(entries);
  }

  public clear(): void {
    this.defs = new Map();
  }
}
