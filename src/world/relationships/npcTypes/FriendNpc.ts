import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import type { NpcSimEvent } from "../NpcState.js";
import { alivePeers, chance } from "./schemeUtils.js";

/**
 * Friends. They match-make single peers, run the gossip network that moves the
 * player's reputation, and can be a genuine lifeline when the player is hurt.
 */
export class FriendNpc extends Npc {
  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    const out: NpcSchemeResult[] = [];
    const peers = alivePeers(ctx, this.id);

    // Matchmaking: pair two single, adult, unrelated friends.
    const singles = peers.filter(
      (p) => !p.life.partnerId && p.life.stage !== "child" && p.life.stage !== "elder",
    );
    if (singles.length >= 2 && chance(ctx, 0.04)) {
      const [a, b] = ctx.random.shuffle(singles).slice(0, 2);
      // The partner edge belongs to the couple (a↔b), not to the matchmaker:
      // applyScheme keys the edge on pairKey(actorId, targetId), so both
      // endpoints must be the pair being wed.
      out.push({
        actorId: a.npc.id,
        targetId: b.npc.id,
        actor: { mood: 6, partnerId: b.npc.id },
        target: { mood: 6, partnerId: a.npc.id },
        edge: { kind: "partner", affinity: 25, trust: 15 },
        player: ctx.knowsPlayer(this.id) ? { effects: { happiness: 2 } } : undefined,
        logKey: "npc.scheme.friend.matchmake",
      });
      return out;
    }

    // Gossip network: word travels and the player's name rises or falls.
    if (ctx.knowsPlayer(this.id) && chance(ctx, 0.05)) {
      const warm = this.traits().warmth >= 0;
      out.push({
        actorId: this.id,
        player: {
          effects: warm
            ? { reputation: 4, happiness: 2 }
            : { reputation: -5, happiness: -2 },
        },
        logKey: warm ? "npc.scheme.friend.gossip.good" : "npc.scheme.friend.gossip.bad",
      });
      return out;
    }

    // Lifeline: a true friend steps in when the player is badly hurt.
    if (
      ctx.knowsPlayer(this.id) &&
      ctx.playerAffinity(this.id) >= 60 &&
      chance(ctx, 0.06)
    ) {
      out.push({
        actorId: this.id,
        player: {
          effects: { health: 14, happiness: 6, depressionValue: -6 },
          bond: { trust: 18, debt: -5 },
          toastKey: "npc.scheme.friend.lifeline",
        },
        logKey: "npc.scheme.friend.lifeline",
      });
    }
    return out;
  }

  public reactToPeer(ev: NpcSimEvent, ctx: NpcYearContext): NpcSchemeResult | null {
    const edge = ctx.edge(this.id, ev.npcId);
    if (!edge || edge.kind !== "friend") return null;
    if (ev.kind === "illness" || ev.kind === "ruin" || ev.kind === "died") {
      if (!chance(ctx, 0.4)) return null;
      return {
        actorId: this.id,
        targetId: ev.npcId,
        target: ev.kind === "died" ? undefined : { mood: 8, health: 4 },
        edge: { affinity: 4, trust: 6 },
        logKey: "npc.scheme.friend.console",
      };
    }
    return null;
  }
}
