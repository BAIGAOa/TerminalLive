import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import { chance, neighbors, pick } from "./schemeUtils.js";

/**
 * Kin. Beyond the role's quiet care autonomies, family NPCs can fall out over
 * a deceased elder's estate and, when a bond sours, cut ties entirely.
 */
export class FamilyNpc extends Npc {
  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    const out: NpcSchemeResult[] = [];
    const kin = neighbors(ctx, this.id);
    if (kin.length === 0) return out;

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
