import { ChronicleContext, meetsUnlock, UnlockCondition } from "./unlock.js";

/** A codex entry — pieces of the world's history and secrets. */
export interface LoreDefinition {
  id: string;
  titleKey: string;
  bodyKey: string;
  category: string;
  unlock: UnlockCondition;
}

export function isLoreUnlocked(
  def: LoreDefinition,
  ctx: ChronicleContext,
): boolean {
  return meetsUnlock(def.unlock, ctx);
}

/** Ids of lore unlocked by the current world state (definition order). */
export function unlockedLore(
  defs: LoreDefinition[],
  ctx: ChronicleContext,
): string[] {
  return defs.filter((d) => isLoreUnlocked(d, ctx)).map((d) => d.id);
}
