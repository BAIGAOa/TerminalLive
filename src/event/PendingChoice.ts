import { ChoiceDef } from "../world/choices.js";

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
}
