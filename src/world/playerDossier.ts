/**
 * Everything the game knows about the player, as plain data.
 *
 * This is the payload handed to the model whenever an AI character has to judge
 * or address the player — the job interviewer, and every NPC who writes a
 * letter. It is deliberately *complete*: stats, money, health, effects,
 * inventory, relationships, flags and career, not a curated summary. An AI that
 * is supposed to know you should be given the same picture the game has.
 *
 * Pure: reads a Player, returns plain JSON-able data.
 */

import Player from "./Player.js";
import { STAT_KEYS } from "./stats.js";

export interface PlayerDossier {
  name: string;
  age: number;
  /** One entry per stat the game tracks, `age` excluded (it has its own field). */
  stats: Array<{ key: string; value: number }>;
  money: number;
  /** Active effect ids. */
  effects: string[];
  /** Inventory, `id ×count`. */
  inventory: Array<{ id: string; count: number }>;
  /** Relationships the player has actually formed (non-zero only). */
  relationships: Array<{ npc: string; value: number }>;
  flags: string[];
  /** Freeform marks the game has been keeping about this life. */
  karma?: number;
  currentCareer: string | null;
  currentRank: number;
}

export function playerDossier(
  player: Player,
  extra: { karma?: number } = {},
): PlayerDossier {
  return {
    name: player.playerName,
    age: Math.floor(player.age),
    stats: STAT_KEYS.filter((k) => k !== "age").map((key) => ({
      key,
      value: Math.round(player.getStat(key) * 100) / 100,
    })),
    money: Math.round(player.money),
    effects: player.activeEffects.map((e) => e.id),
    inventory: player.inventory.map((s) => ({ id: s.id, count: s.count })),
    relationships: [...player.relationships.entries()]
      .filter(([, v]) => v !== 0)
      .map(([npc, value]) => ({ npc, value })),
    flags: [...player.flags],
    karma: extra.karma,
    currentCareer: player.careerId,
    currentRank: player.careerRank,
  };
}
