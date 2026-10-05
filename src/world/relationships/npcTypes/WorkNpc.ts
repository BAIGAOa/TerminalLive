import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import { alivePeers, chance, pick } from "./schemeUtils.js";

/**
 * Bosses and colleagues. Once the player is in the working world, a work NPC
 * can betray them (skim money, sell them out), champion them for a promotion,
 * or poach a rival's talent — the full range of office politics.
 */
export class WorkNpc extends Npc {
  /** Work belongs to adulthood; never touches a child. */
  public autonomyAgeWindow() {
    return { min: 18 };
  }

  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    if (!ctx.knowsPlayer(this.id)) return [];
    const aff = ctx.playerAffinity(this.id);
    const t = this.traits();

    // Betrayal: low warmth/trust and a cold relationship → the player is robbed.
    if (aff < 35 && chance(ctx, 0.05 + Math.max(0, t.ambition - 0.5) * 0.1)) {
      return [
        {
          actorId: this.id,
          actor: { wealth: 12, mood: 4 },
          player: {
            effects: { money: -220, reputation: -6, angerValue: 6 },
            karma: { rebellion: 3 },
            bond: { trust: -18, conflict: 14, debt: 20 },
            toastKey: "npc.scheme.work.betrayal",
          },
          logKey: "npc.scheme.work.betrayal",
        },
      ];
    }

    // Patronage: high trust → a sponsor who lifts the player's standing.
    if (aff >= 60 && chance(ctx, 0.06)) {
      return [
        {
          actorId: this.id,
          player: {
            effects: { reputation: 8, money: 120, happiness: 3 },
            bond: { trust: 10 },
            toastKey: "npc.scheme.work.patronage",
          },
          logKey: "npc.scheme.work.patronage",
        },
      ];
    }

    // Poach: a colleague lures a talented peer away from a rival.
    const peer = pick(
      ctx,
      alivePeers(ctx, this.id).filter((p) => p.life.stage === "adult"),
    );
    if (peer && chance(ctx, 0.03)) {
      return [
        {
          actorId: this.id,
          targetId: peer.npc.id,
          actor: { wealth: 6 },
          target: { careerTier: 1, wealth: 5, mood: 4 },
          edge: { affinity: 6, trust: 4 },
          logKey: "npc.scheme.work.poach",
        },
      ];
    }
    return [];
  }
}
