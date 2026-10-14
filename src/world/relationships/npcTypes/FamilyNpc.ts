import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import { emigrationPressure, regionDisposition } from "../../regions/npcRegion.js";
import { chance, homeOf, neighbors, pick } from "./schemeUtils.js";

/**
 * Kin. Beyond the role's quiet care autonomies, family NPCs can fall out over
 * a deceased elder's estate and, when a bond sours, cut ties entirely.
 */
export class FamilyNpc extends Npc {
  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    const out: NpcSchemeResult[] = [];
    const kin = neighbors(ctx, this.id);
    if (kin.length === 0) return out;

    // When home stops being habitable the family scatters — the exact thing a
    // collapsing region should mean to the people living in it. Inert with no
    // region view, or somewhere merely ordinary.
    const home = homeOf(ctx, this.id);
    if (
      regionDisposition(home) === "bust" &&
      chance(ctx, 0.08 + emigrationPressure(home) * 0.12)
    ) {
      return [
        {
          actorId: this.id,
          targetId: kin[0].npc.id,
          actor: { moved: true, mood: -6, wealth: -8 },
          target: { moved: true, mood: -8 },
          player: ctx.knowsPlayer(this.id)
            ? {
                effects: { happiness: -3 },
                bond: { conflict: 6, trust: -4 },
                toastKey: "npc.scheme.family.emigrate",
              }
            : undefined,
          logKey: "npc.scheme.family.emigrate",
        },
      ];
    }

    // Inheritance dispute: an ageing relative's estate invites a scramble.
    const elder = pick(
      ctx,
      kin.filter((p) => p.life.stage === "elder" || p.life.wealth > 60),
    );
    if (elder && chance(ctx, 0.05)) {
      const toPlayer = ctx.knowsPlayer(this.id);
      out.push({
        actorId: this.id,
        targetId: elder.npc.id,
        actor: { wealth: 10, flags: ["inheritance_claim"] },
        target: { wealth: -15, mood: -8 },
        edge: { affinity: -12, trust: -8 },
        player: toPlayer
          ? { effects: { money: 300, happiness: -3 }, karma: { ambition: 8 } }
          : undefined,
        logKey: "npc.scheme.family.inheritance",
      });
      return out;
    }

    // Estrangement: a fraying kin bond snaps into a rivalry.
    const frayed = pick(
      ctx,
      kin.filter((p) => {
        const e = ctx.edge(this.id, p.npc.id);
        return !!e && e.affinity < 35;
      }),
    );
    if (frayed && chance(ctx, 0.04)) {
      out.push({
        actorId: this.id,
        targetId: frayed.npc.id,
        target: { mood: -10 },
        edge: { kind: "rival", affinity: -25, trust: -15 },
        logKey: "npc.scheme.family.estrangement",
      });
    }
    return out;
  }
}
