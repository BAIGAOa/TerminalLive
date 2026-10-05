import Player from "./Player.js";
import { Requirement } from "./stats.js";

export function meetsRequirement(player: Player, req: Requirement): boolean {
  // A requirement with no target is malformed content, not an open gate:
  // fail closed so a content typo can never silently unlock an action.
  if (req.npc === undefined && req.prop === undefined) return false;
  const value =
    req.npc !== undefined
      ? player.getRelationship(req.npc)
      : player.getStat(req.prop!);
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
