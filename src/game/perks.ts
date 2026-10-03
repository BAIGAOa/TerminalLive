import { Requirement } from "../world/stats.js";

/** A milestone "perk" — derived from the player's stats/relationships. */
export interface PerkDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  icon?: string;
  requirement: Requirement;
}

/** Perks are computed, not stored: unlocked whenever the requirement holds. */
export const PERKS: PerkDefinition[] = [
  { id: "scholar", labelKey: "perk.scholar", descKey: "perk.scholar.desc", icon: "🎓", requirement: { prop: "intelligence", gte: 70 } },
  { id: "charmer", labelKey: "perk.charmer", descKey: "perk.charmer.desc", icon: "💬", requirement: { prop: "social", gte: 70 } },
  { id: "athlete", labelKey: "perk.athlete", descKey: "perk.athlete.desc", icon: "🏅", requirement: { prop: "fitness", gte: 70 } },
  { id: "wealthy", labelKey: "perk.wealthy", descKey: "perk.wealthy.desc", icon: "💎", requirement: { prop: "money", gte: 1000 } },
  { id: "content", labelKey: "perk.content", descKey: "perk.content.desc", icon: "😌", requirement: { prop: "happiness", gte: 80 } },
  { id: "famous", labelKey: "perk.famous", descKey: "perk.famous.desc", icon: "📣", requirement: { prop: "reputation", gte: 70 } },
  { id: "loved", labelKey: "perk.loved", descKey: "perk.loved.desc", icon: "❤️", requirement: { npc: "npc_partner", gte: 70 } },
  { id: "beloved", labelKey: "perk.beloved", descKey: "perk.beloved.desc", icon: "👨👩👧", requirement: { npc: "npc_child", gte: 70 } },
  { id: "veteran", labelKey: "perk.veteran", descKey: "perk.veteran.desc", icon: "🕰", requirement: { prop: "age", gte: 60 } },
];
