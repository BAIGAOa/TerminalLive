/** Pure skill-tier logic for the skills status view. React-free. */

/** The three core skills the skills view averages. */
export interface CoreSkills {
  intelligence: number;
  social: number;
  fitness: number;
}

/** Average of the three core skills (the skills-view headline score). */
export function averageCoreSkills(skills: CoreSkills): number {
  return (skills.intelligence + skills.social + skills.fitness) / 3;
}

/** i18n key of the tier a given average falls into. */
export function skillTier(avg: number): string {
  if (avg >= 90) return "skillTier.legend";
  if (avg >= 75) return "skillTier.expert";
  if (avg >= 55) return "skillTier.adept";
  if (avg >= 35) return "skillTier.learner";
  return "skillTier.novice";
}
