import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import { chance } from "./schemeUtils.js";

/**
 * A mentor. Quietly lifts the player's mind, and — once trust is high — opens
 * doors with a real reputation-making referral (patronage).
 */
export class MentorNpc extends Npc {
  /** Mentors don't consort with the player before school age. */
  public autonomyAgeWindow() {
    return { min: 6 };
  }

  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    if (!ctx.knowsPlayer(this.id)) return [];
    const aff = ctx.playerAffinity(this.id);

    if (aff >= 55 && chance(ctx, 0.05)) {
      return [
        {
          actorId: this.id,
          player: {
            effects: { reputation: 10, intelligence: 5, happiness: 3 },
            karma: { wisdom: 4 },
            bond: { trust: 8 },
            toastKey: "npc.scheme.mentor.patronage",
          },
          logKey: "npc.scheme.mentor.patronage",
        },
      ];
    }

    if (chance(ctx, 0.08)) {
      return [
        {
          actorId: this.id,
          player: {
            effects: { intelligence: 6, depressionValue: -4 },
            karma: { wisdom: 3 },
          },
          logKey: "npc.scheme.mentor.wisdom",
        },
      ];
    }
    return [];
  }
}
