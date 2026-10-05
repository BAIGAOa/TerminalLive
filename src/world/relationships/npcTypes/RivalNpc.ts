import { Npc } from "../Npc.js";
import type { NpcSchemeResult, NpcYearContext } from "../NpcScheme.js";
import type { NpcSimEvent } from "../NpcState.js";
import { chance, neighbors, pick } from "./schemeUtils.js";

/**
 * A rival. The darkest archetype: it sabotages other NPCs, and — once the
 * player knows it — blackmails, frames and ensnares them with real,
 * consequence-heavy hits rather than a token scratch.
 */
export class RivalNpc extends Npc {
  /** Rivalry is an adult affair; a rival never menaces a child. */
  public autonomyAgeWindow() {
    return { min: 12 };
  }

  public peerScheme(ctx: NpcYearContext): NpcSchemeResult[] {
    const out: NpcSchemeResult[] = [];

    // Sabotage a peer's standing: drain their wealth and morale.
    const enemy = pick(
      ctx,
      neighbors(ctx, this.id).filter((p) => p.life.stage !== "child"),
    );
    if (enemy && chance(ctx, 0.06)) {
      out.push({
        actorId: this.id,
        targetId: enemy.npc.id,
        actor: { mood: 3 },
        target: { wealth: -20, mood: -12, health: -3 },
        edge: { trust: -10, affinity: -6 },
        player: ctx.knowsPlayer(this.id) ? { effects: { happiness: 1 } } : undefined,
        logKey: "npc.scheme.rival.sabotage",
      });
      return out;
    }

    if (!ctx.knowsPlayer(this.id)) return out;
    const aff = ctx.playerAffinity(this.id);

    // Blackmail: leverage over the player converts into money or pain.
    if (aff >= 8 && chance(ctx, 0.05)) {
      out.push({
        actorId: this.id,
        actor: {},
        player: {
          effects: { money: -150, happiness: -5, angerValue: 6 },
          bond: { debt: -25, conflict: 12 },
          toastKey: "npc.scheme.rival.blackmail",
        },
        logKey: "npc.scheme.rival.blackmail",
      });
      return out;
    }

    // Framing: the player's name is dragged through the mud.
    if (chance(ctx, 0.045)) {
      out.push({
        actorId: this.id,
        player: {
          effects: { reputation: -12, happiness: -6, angerValue: 8 },
          bond: { conflict: 16, trust: -10 },
          toastKey: "npc.scheme.rival.frame",
        },
        logKey: "npc.scheme.rival.frame",
      });
      return out;
    }

    // Snare: an enticement that leaves a lasting, draining effect.
    if (chance(ctx, 0.035)) {
      out.push({
        actorId: this.id,
        player: {
          effects: { health: -8, happiness: -4, weakValue: 8 },
          buff: { id: "fx_sick", turns: 3 },
          toastKey: "npc.scheme.rival.snare",
        },
        logKey: "npc.scheme.rival.snare",
      });
    }
    return out;
  }

  public reactToPeer(ev: NpcSimEvent, ctx: NpcYearContext): NpcSchemeResult | null {
    const edge = ctx.edge(this.id, ev.npcId);
    if (!edge || edge.kind !== "rival") return null;
    // Envy: a rival's good fortune curdles the relationship further.
    if (
      (ev.kind === "promote" || ev.kind === "windfall" || ev.kind === "married") &&
      chance(ctx, 0.5)
    ) {
      return {
        actorId: this.id,
        targetId: ev.npcId,
        actor: { mood: -4 },
        target: { mood: -6 },
        edge: { affinity: -5, trust: -4 },
        logKey: "npc.scheme.rival.envy",
      };
    }
    return null;
  }
}
