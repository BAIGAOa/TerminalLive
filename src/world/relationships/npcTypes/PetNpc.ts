import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import { chance } from "./schemeUtils.js";

/**
 * A pet. No schemes against other NPCs — just steady, unconditional comfort
 * (and the occasional bit of mischief) for the player.
 */
export class PetNpc extends Npc {
  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    if (!ctx.knowsPlayer(this.id)) return [];
    if (chance(ctx, 0.14)) {
      return [
        {
          actorId: this.id,
          player: {
            effects: { happiness: 3, depressionValue: -3 },
            toastKey: "npc.scheme.pet.comfort",
          },
          logKey: "npc.scheme.pet.comfort",
        },
      ];
    }
    return [];
  }
}
