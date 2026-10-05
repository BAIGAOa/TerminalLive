import Player from "../Player.js";
import type { StatKey } from "../stats.js";
import type { CareerRank } from "./CareerDefinition.js";

/** Pure view-model for a career rank's promotion requirements (React-free). */

export interface CareerRequirementStatus {
  /** The stat being gated, when the requirement targets a player stat. */
  prop: StatKey | null;
  /** The NPC whose affinity is gated, when the requirement targets a bond. */
  npc: string | null;
  /** The player's current value against the requirement. */
  value: number;
  /** The threshold shown to the player (gte preferred over lte). */
  need: number;
  met: boolean;
}

/**
 * Resolve each of a rank's requirements against the player. Mirrors the career
 * view's original inline logic: a requirement with neither prop nor npc reads
 * as 0 against a threshold of 0 (and so is "met").
 */
export function careerRequirementsMet(
  player: Player,
  rankDef: CareerRank,
): CareerRequirementStatus[] {
  return rankDef.requires.map((req) => {
    const value =
      req.npc !== undefined
        ? player.getRelationship(req.npc)
        : req.prop !== undefined
          ? player.getStat(req.prop)
          : 0;
    const need = req.gte ?? req.lte ?? 0;
    const met =
      (req.gte === undefined || value >= req.gte) &&
      (req.lte === undefined || value <= req.lte);
    return { prop: req.prop ?? null, npc: req.npc ?? null, value, need, met };
  });
}
