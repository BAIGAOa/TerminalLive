import z from "zod";

export const saveDataSchema = z.object({
  version: z.number(),
  appVersion: z.string(),
  timestamp: z.string(),
  player: z.object({
    playerName: z.string(),
    age: z.number(),
    health: z.number(),
    height: z.number(),
    weight: z.number(),
    money: z.number().default(0),
    intelligence: z.number().default(0),
    social: z.number().default(0),
    fitness: z.number().default(0),
    happiness: z.number().default(50),
    reputation: z.number().default(0),
    angerValue: z.number(),
    excitationValue: z.number(),
    depressionValue: z.number(),
    weakValue: z.number(),
    effects: z
      .array(
        z.object({
          id: z.string(),
          remaining: z.number(),
          stacks: z.number(),
        }),
      )
      .default([]),
    inventory: z
      .array(z.object({ id: z.string(), count: z.number() }))
      .default([]),
    relationships: z.record(z.string(), z.number()).default({}),
    flags: z.array(z.string()).default([]),
    actionPoints: z.number().default(0),
    careerId: z.string().nullable().default(null),
    careerRank: z.number().default(0),
  }),
  history: z.object({
    triggered: z.array(z.string()),
    blocked: z.array(z.string()),
    rangeRecord: z.record(z.string(), z.array(z.string())),
    /** Age each event last fired (cooldown bookkeeping). */
    triggeredAge: z.record(z.string(), z.number()).default({}),
    /** Age each category last fired (same-class decay bookkeeping). */
    categoryAge: z.record(z.string(), z.number()).default({}),
    lastId: z.string().nullable().default(null),
    consecutiveCount: z.number().default(0),
  }),
  achievements: z.array(
    z.object({
      id: z.string(),
      unlockedAt: z.number().nullable(),
    }),
  ),
  config: z.object({
    language: z.string(),
    theme: z.string().default("default"),
    enabledMods: z.array(z.string()),
    traits: z.array(z.string()).default([]),
  }),
  levels: z.object({
    currentLevel: z.string(),
    completedLevels: z.array(z.string()),
  }),
  world: z
    .object({
      year: z.number().default(0),
      eraId: z.string().default(""),
      regionId: z.string().default(""),
      karma: z.record(z.string(), z.number()).default({}),
      standing: z.record(z.string(), z.number()).default({}),
      unlockedLore: z.array(z.string()).default([]),
      activeFates: z.array(z.string()).default([]),
      firedWorldEvents: z.array(z.string()).default([]),
    })
    .default({
      year: 0,
      eraId: "",
      regionId: "",
      karma: {},
      standing: {},
      unlockedLore: [],
      activeFates: [],
      firedWorldEvents: [],
    }),
  pressures: z.record(z.string(), z.number()).default({}),
  weather: z.string().default("weather_clear"),
  /** Seeded RNG position — resume the exact same stream on load. */
  random: z
    .object({ seed: z.number(), step: z.number() })
    .default({ seed: 0, step: 0 }),
  /** Post-event graph bookkeeping (fired edges / runs / groups). */
  chain: z
    .object({
      firedEdges: z.array(z.string()).default([]),
      runs: z.record(z.string(), z.number()).default({}),
      firedGroups: z.array(z.string()).default([]),
    })
    .default({ firedEdges: [], runs: {}, firedGroups: [] }),
  /** Narrative director streak memory. */
  director: z.object({ fortune: z.number().default(0) }).default({ fortune: 0 }),
  /** A choice event awaiting the player's pick when the save was taken. */
  pendingChoice: z
    .object({ incidentId: z.string(), rangeKey: z.string() })
    .nullable()
    .default(null),
});

export type SaveData = z.infer<typeof saveDataSchema>;

export interface SaveMeta {
  name: string;
  timestamp: string;
  playerName: string;
  age: number;
  appVersion: string;
}