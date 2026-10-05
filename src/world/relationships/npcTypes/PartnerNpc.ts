import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import type { NpcSimEvent } from "../NpcState.js";
import { chance } from "./schemeUtils.js";

/**
 * A partner. A steady source of support — and, when the bond frays, of jealousy
 * that bleeds into the player's mood and the couple's trust.
 */
export class PartnerNpc extends Npc {
  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    if (!ctx.knowsPlayer(this.id)) return [];
    const aff = ctx.playerAffinity(this.id);

    if (aff >= 45 && chance(ctx, 0.12)) {
      return [
        {
          actorId: this.id,
          player: {
            effects: { happiness: 6, depressionValue: -5, health: 2 },
            bond: { trust: 6, conflict: -3 },
            toastKey: "npc.scheme.partner.support",
          },
          logKey: "npc.scheme.partner.support",
        },
      ];
    }

    if (aff < 30 && chance(ctx, 0.1)) {
      return [
        {
          actorId: this.id,
          player: {
            effects: { happiness: -6, depressionValue: 6, angerValue: 3 },
            bond: { conflict: 10, trust: -6 },
            toastKey: "npc.scheme.partner.jealousy",
          },
          logKey: "npc.scheme.partner.jealousy",
        },
      ];
    }
    return [];
  }

  public reactToPeer(ev: NpcSimEvent, ctx: NpcYearContext): NpcSchemeResult | null {
    const edge = ctx.edge(this.id, ev.npcId);
    if (!edge || edge.kind !== "partner") return null;
    if (ev.kind === "illness" && chance(ctx, 0.6)) {
      return {
        actorId: this.id,
        targetId: ev.npcId,
        target: { mood: 10, health: 6 },
        edge: { affinity: 5, trust: 8 },
        logKey: "npc.scheme.partner.care",
      };
    }
    return null;
  }
}
