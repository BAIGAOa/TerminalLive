import { ChoiceDef } from "../world/choices.js";
import type { Incident } from "../world/Incident.js";

/** One option in a pending choice, flagged disabled when its gate is unmet. */
export interface PendingOption {
  def: ChoiceDef;
  disabled: boolean;
}

/** A choice event awaiting the player's decision. */
export interface PendingChoice {
  incidentId: string;
  nameKey: string | null;
  textKey: string | null;
  rangeKey: string;
  /** Options the player may pick (hidden+unmet ones already removed). */
  options: PendingOption[];
  /**
   * The live incident, when the choice did not come from the event pool (e.g.
   * an NPC-initiated offer). `resolveChoice` prefers it over an EventCenter
   * lookup. Not serialized — external offers are dropped on reload.
   */
  incident?: Incident;
}
