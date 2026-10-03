/** A historical era the world passes through during a life. */
export interface EraDefinition {
  id: string;
  labelKey: string;
  descKey: string;
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
