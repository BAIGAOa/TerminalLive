import { ArcDef } from "../world/narrative/narrativeEngine.js";

/**
 * The builtin life through-lines. Each advances through stages as the player's
 * stats, karma, flags and bonds cross thresholds, so a life reads as a directed
 * story rather than a scatter of events.
 */
export const ARCS: ArcDef[] = [
  {
    id: "scholar",
    labelKey: "arc.scholar.title",
    descKey: "arc.scholar.desc",
    stages: [
      { id: "s1", labelKey: "arc.scholar.s1", requires: { minStats: { intelligence: 30 } } },
      {
        id: "s2",
        labelKey: "arc.scholar.s2",
        requires: { minStats: { intelligence: 50 }, minKarma: { wisdom: 20 } },
      },
      { id: "s3", labelKey: "arc.scholar.s3", requires: { minStats: { intelligence: 75 } } },
    ],
  },
  {
    id: "entrepreneur",
    labelKey: "arc.entrepreneur.title",
    descKey: "arc.entrepreneur.desc",
    stages: [
      { id: "s1", labelKey: "arc.entrepreneur.s1", requires: { minStats: { money: 200 } } },
      { id: "s2", labelKey: "arc.entrepreneur.s2", requires: { hasCareer: true } },
      { id: "s3", labelKey: "arc.entrepreneur.s3", requires: { minStats: { money: 5000 } } },
    ],
  },
  {
    id: "revenge",
    labelKey: "arc.revenge.title",
    descKey: "arc.revenge.desc",
    stages: [
      { id: "s1", labelKey: "arc.revenge.s1", requires: { minKarma: { rebellion: 20 } } },
      { id: "s2", labelKey: "arc.revenge.s2", requires: { flags: ["world_coup"] } },
      { id: "s3", labelKey: "arc.revenge.s3", requires: { minKarma: { rebellion: 60 } } },
    ],
  },
  {
    id: "family",
    labelKey: "arc.family.title",
    descKey: "arc.family.desc",
    stages: [
      { id: "s1", labelKey: "arc.family.s1", requires: { minRelationship: 60 } },
      { id: "s2", labelKey: "arc.family.s2", requires: { minRelationship: 80 } },
      {
        id: "s3",
        labelKey: "arc.family.s3",
        requires: { minRelationship: 80, minStats: { age: 50 } },
      },
    ],
  },
];

export function arcsById(): Record<string, ArcDef> {
  const out: Record<string, ArcDef> = {};
  for (const a of ARCS) out[a.id] = a;
  return out;
}
