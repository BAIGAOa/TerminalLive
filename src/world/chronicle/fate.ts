import { ChronicleContext, meetsUnlock, UnlockCondition } from "./unlock.js";

/**
 * A fate arc — a destiny that locks in when the world state matches its
 * condition. Active arcs bias the event roll toward their favoured events and
 * can grant a timed effect the moment they awaken.
 */
export interface FateArcDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  icon?: string;
  unlock: UnlockCondition;
  /** Event ids this arc makes more likely. */
  favorEvents?: string[];
  /** Weight multiplier applied to favoured events (default 2). */
  factor?: number;
  /** Timed effect granted when the arc awakens. */
  buff?: { id: string; turns?: number };
}

/** Fate arc ids whose condition now holds (definition order). */
export function evaluateFates(
  defs: FateArcDefinition[],
  ctx: ChronicleContext,
): string[] {
  return defs.filter((d) => meetsUnlock(d.unlock, ctx)).map((d) => d.id);
}

/** Combined weight multiplier for `eventId` from all active fate arcs. */
export function fateWeightFactor(
  defs: FateArcDefinition[],
  active: Set<string>,
  eventId: string,
): number {
  let factor = 1;
  for (const def of defs) {
    if (!active.has(def.id)) continue;
    if (def.favorEvents?.includes(eventId)) {
      factor *= def.factor ?? 2;
    }
  }
  return factor;
}
