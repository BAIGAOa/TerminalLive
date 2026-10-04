import Player from "../Player.js";
import { StatDelta } from "../stats.js";
import { KarmaDelta } from "../chronicle/karma.js";
import type WorldState from "../chronicle/WorldState.js";
import { container } from "../../Container.js";
import CareerSystem from "../careers/CareerSystem.js";

/** The set of outcomes an action / choice / post-event can apply. */
export interface EffectPayload {
  effects?: StatDelta;
  items?: string[];
  removeItems?: string[];
  relationship?: { npc: string; delta: number };
  buff?: { id: string; turns?: number };
  flag?: string;
  /** Karma added to the world ledger. */
  karma?: KarmaDelta;
  /** Faction standing shifted in the world. */
  faction?: { id: string; delta: number };
  /** Take a job in this career track. */
  career?: string;
  /** Leave the current job. */
  quitJob?: boolean;
}

export function applyEffectPayload(
  player: Player,
  payload: EffectPayload,
  world?: WorldState | null,
): void {
  if (payload.effects) player.applyDelta(payload.effects);
  if (payload.items) for (const id of payload.items) player.addItem(id);
  if (payload.removeItems) for (const id of payload.removeItems) player.removeItem(id);
  if (payload.relationship) {
    player.adjustRelationship(payload.relationship.npc, payload.relationship.delta);
  }
  if (payload.buff) player.addEffect(payload.buff.id, payload.buff.turns);
  if (payload.flag) player.setFlag(payload.flag);
  if (payload.career) container.resolve(CareerSystem).join(player, payload.career);
  if (payload.quitJob) container.resolve(CareerSystem).quit(player);
  if (world) {
    if (payload.karma) world.applyKarma(payload.karma);
    if (payload.faction) {
      world.adjustStanding(payload.faction.id, payload.faction.delta);
    }
  }
}
