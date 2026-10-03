/** A power bloc the player can earn standing with. */
export interface FactionDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  icon?: string;
  /** Faction ids this one is at odds with (informational). */
  rivals?: string[];
}
