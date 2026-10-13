/** A historical era the world passes through during a life. */
export interface EraDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  /**
   * Translation key for the era's line in the narrator's scene paragraph.
   *
   * Worlds and eras are the one piece of the narration vocabulary that is *not*
   * global: the core language pack only ever knew the classic world's eras, and
   * every other world names its own in its own file (`wilds.era.1`). Without
   * this, the narrator falls back to `descKey` and then `labelKey` — both of
   * which the world does define — rather than emitting a key nobody has.
   */
  narrKey?: string;
  /** World year at which this era begins. */
  fromYear: number;
  icon?: string;
  color?: string;
}

/** The era in effect at `year` (the last era whose `fromYear` has passed). */
export function eraForYear(
  eras: EraDefinition[],
  year: number,
): EraDefinition | undefined {
  let current: EraDefinition | undefined;
  for (const era of [...eras].sort((a, b) => a.fromYear - b.fromYear)) {
    if (year >= era.fromYear) current = era;
  }
  return current;
}
