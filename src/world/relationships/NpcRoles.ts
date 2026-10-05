import type { AgeWindow } from "./AgeWindow.js";

/**
 * Role → archetype-type inference, so old NPC JSON (roleKey only) resolves to
 * the right built-in class without an explicit `type`. Mirrors the way events
 * default their behaviour from `type` while staying backward compatible.
 */
export const ROLE_TO_TYPE: Record<string, string> = {
  "npc.role.family": "family",
  "npc.role.friend": "friend",
  "npc.role.mentor": "mentor",
  "npc.role.partner": "partner",
  "npc.role.work": "work",
  "npc.role.rival": "rival",
  "npc.role.pet": "pet",
};

/**
 * When the *player* comes to know an NPC of a given role. This is the fix for
 * the "boss asks a toddler to work overtime" bug: a work NPC (boss/colleague)
 * simply isn't part of the player's life until adulthood, so none of its
 * autonomy or schemes can touch an infant. A per-NPC `knownFromAge` /
 * `knownUntilAge` in the JSON overrides the role default.
 */
export const ROLE_KNOW_WINDOW: Record<string, AgeWindow> = {
  "npc.role.family": { min: 0 },
  "npc.role.pet": { min: 0 },
  "npc.role.friend": { min: 3 },
  "npc.role.mentor": { min: 6 },
  "npc.role.rival": { min: 12 },
  "npc.role.partner": { min: 13 },
  "npc.role.work": { min: 18 },
};
