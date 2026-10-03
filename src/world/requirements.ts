import Player from "./Player.js";
import { Requirement } from "./stats.js";

export function meetsRequirement(player: Player, req: Requirement): boolean {
  const value =
    req.npc !== undefined
      ? player.getRelationship(req.npc)
      : req.prop !== undefined
        ? player.getStat(req.prop)
        : undefined;
  if (value === undefined) return true;
  if (req.gte !== undefined && value < req.gte) return false;
  if (req.lte !== undefined && value > req.lte) return false;
  return true;
}

export function meetsRequirements(
  player: Player,
  reqs: Requirement[] | undefined,
): boolean {
  if (!reqs || reqs.length === 0) return true;
  return reqs.every((r) => meetsRequirement(player, r));
}
