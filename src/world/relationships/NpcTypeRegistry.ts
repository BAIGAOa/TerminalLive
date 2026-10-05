import type { NpcDefinition } from "./NpcDefinition.js";
import { Npc, type NpcConstructor } from "./Npc.js";
import { ROLE_TO_TYPE } from "./NpcRoles.js";
import { GenericNpc } from "./npcTypes/GenericNpc.js";

/**
 * The NPC archetype registry — the direct analogue of `EventTypeRegistry`.
 * A `type` string in the NPC JSON maps to an {@link Npc} subclass; mods can
 * register their own types. Unlike event types, resolution is *lenient*: an
 * unknown or missing type falls back to the generic archetype so content
 * loading is never broken by one bad `type`.
 */
export default class NpcTypeRegistry {
  private readonly types = new Map<string, NpcConstructor>();

  public register(name: string, ctor: NpcConstructor): void {
    if (this.types.has(name)) {
      throw new Error(`NPC 类型 "${name}" 已注册`);
    }
    this.types.set(name, ctor);
  }

  /** Register only if the name is free (hot-reload / mod friendly). */
  public registerIfAbsent(name: string, ctor: NpcConstructor): boolean {
    if (this.types.has(name)) return false;
    this.types.set(name, ctor);
    return true;
  }

  public has(name: string): boolean {
    return this.types.has(name);
  }

  /** The type key for a def: explicit `type`, else inferred from role, else generic. */
  public resolveTypeKey(def: NpcDefinition): string {
    return def.type ?? ROLE_TO_TYPE[def.roleKey ?? ""] ?? "generic";
  }

  /** Build the instance for a def, falling back to the generic archetype. */
  public createForDef(def: NpcDefinition): Npc {
    const key = this.resolveTypeKey(def);
    const ctor = this.types.get(key) ?? this.types.get("generic") ?? GenericNpc;
    // Normalise `type` onto the def so the instance reports its resolved type.
    return new ctor(def.type ? def : { ...def, type: key }).init();
  }

  /** Strict construction by name (throws when the type is unknown). */
  public create(name: string, def: NpcDefinition): Npc {
    const ctor = this.types.get(name);
    if (!ctor) throw new Error(`未知 NPC 类型: "${name}"`);
    return new ctor(def).init();
  }

  public getKeys(): string[] {
    return [...this.types.keys()];
  }
}
