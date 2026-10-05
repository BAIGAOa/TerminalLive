import { container } from "../../Container.js";
import type { NpcConstructor } from "./Npc.js";
import NpcTypeRegistry from "./NpcTypeRegistry.js";
import { FamilyNpc } from "./npcTypes/FamilyNpc.js";
import { FriendNpc } from "./npcTypes/FriendNpc.js";
import { GenericNpc } from "./npcTypes/GenericNpc.js";
import { MentorNpc } from "./npcTypes/MentorNpc.js";
import { PartnerNpc } from "./npcTypes/PartnerNpc.js";
import { PetNpc } from "./npcTypes/PetNpc.js";
import { RivalNpc } from "./npcTypes/RivalNpc.js";
import { WorkNpc } from "./npcTypes/WorkNpc.js";

/**
 * Built-in NPC archetypes, keyed by type name. Mirrors `EventTypes`: a single
 * idempotent `registerAll()` wires every built-in class into the registry.
 */
export const NPC_TYPES: Record<string, NpcConstructor> = {
  generic: GenericNpc,
  family: FamilyNpc,
  friend: FriendNpc,
  mentor: MentorNpc,
  partner: PartnerNpc,
  work: WorkNpc,
  rival: RivalNpc,
  pet: PetNpc,
};

export default class NpcTypes {
  private static init = false;

  public static registerAll(): void {
    if (this.init) return;
    this.init = true;
    const registry = container.resolve(NpcTypeRegistry);
    for (const [key, ctor] of Object.entries(NPC_TYPES)) {
      registry.registerIfAbsent(key, ctor);
    }
  }
}

export { ROLE_KNOW_WINDOW, ROLE_TO_TYPE } from "./NpcRoles.js";
