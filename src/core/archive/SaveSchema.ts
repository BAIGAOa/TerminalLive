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
  /** Objective progress on the current level, so a resume can't re-grant them. */
  levelObjectives: z
    .object({
      levelId: z.string().nullable().default(null),
      completed: z.array(z.string()).default([]),
    })
    .default({ levelId: null, completed: [] }),
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
  /** The NPC simulation: per-NPC state, the NPC↔NPC graph, and player bonds. */
  npcSim: z
    .object({
      lives: z
        .record(
          z.string(),
          z.object({
            age: z.number().default(30),
            stage: z.enum(["child", "youth", "adult", "elder"]).default("adult"),
            alive: z.boolean().default(true),
            health: z.number().default(70),
            wealth: z.number().default(30),
            mood: z.number().default(50),
            careerTier: z.number().default(0),
            partnerId: z.string().nullable().default(null),
            children: z.number().default(0),
            moved: z.boolean().default(false),
            homeRegion: z.string().nullable().default(null),
            goals: z.array(z.string()).default([]),
          }),
        )
        .default({}),
      edges: z
        .record(
          z.string(),
          z.object({
            kind: z
              .enum(["kin", "friend", "rival", "partner", "colleague"])
              .default("friend"),
            affinity: z.number().default(0),
            trust: z.number().default(50),
          }),
        )
        .default({}),
      bonds: z
        .record(
          z.string(),
          z.object({
            trust: z.number().default(40),
            debt: z.number().default(0),
            conflict: z.number().default(0),
          }),
        )
        .default({}),
    })
    .default({ lives: {}, edges: {}, bonds: {} }),
  /** Work life: career ladder progress, skills, politics and any venture. */
  career: z
    .object({
      work: z
        .object({
          careerId: z.string().nullable().default(null),
          rank: z.number().default(0),
          tenure: z.number().default(0),
          performance: z.number().default(40),
          burnout: z.number().default(0),
          skills: z.record(z.string(), z.number()).default({}),
          certs: z.array(z.string()).default([]),
          standing: z.record(z.string(), z.number()).default({}),
          venture: z
            .object({
              industry: z.string(),
              capital: z.number(),
              staff: z.number(),
              product: z.number(),
              revenue: z.number(),
              risk: z.number(),
            })
            .nullable()
            .default(null),
        })
        .default({
          careerId: null,
          rank: 0,
          tenure: 0,
          performance: 40,
          burnout: 0,
          skills: {},
          certs: [],
          standing: {},
          venture: null,
        }),
    })
    .default({
      work: {
        careerId: null,
        rank: 0,
        tenure: 0,
        performance: 40,
        burnout: 0,
        skills: {},
        certs: [],
        standing: {},
        venture: null,
      },
    }),
  /** Market + personal portfolio/debt. */
  economy: z
    .object({
      market: z
        .object({
          year: z.number().default(0),
          inflation: z.number().default(0.03),
          priceIndex: z.number().default(1),
          houseIndex: z.number().default(1),
          stocks: z.record(z.string(), z.number()).default({}),
        })
        .default({
          year: 0,
          inflation: 0.03,
          priceIndex: 1,
          houseIndex: 1,
          stocks: {},
        }),
      portfolio: z
        .object({
          holdings: z
            .record(z.string(), z.object({ shares: z.number(), avgCost: z.number() }))
            .default({}),
          loans: z
            .array(z.object({ id: z.string(), principal: z.number(), rate: z.number() }))
            .default([]),
          properties: z
            .array(
              z.object({
                id: z.string(),
                value: z.number(),
                rent: z.number(),
                mortgage: z
                  .object({ id: z.string(), principal: z.number(), rate: z.number() })
                  .optional(),
              }),
            )
            .default([]),
        })
        .default({ holdings: {}, loans: [], properties: [] }),
    })
    .default({
      market: {
        year: 0,
        inflation: 0.03,
        priceIndex: 1,
        houseIndex: 1,
        stocks: {},
      },
      portfolio: { holdings: {}, loans: [], properties: [] },
    }),
  /** Body & mind: conditions, trauma/resilience/meaning, addictions. */
  health: z
    .object({
      conditions: z
        .record(
          z.string(),
          z.object({ severity: z.number().default(0), sinceAge: z.number().default(0) }),
        )
        .default({}),
      trauma: z.number().default(0),
      resilience: z.number().default(40),
      meaning: z.number().default(50),
      addictions: z
        .record(
          z.string(),
          z.object({ dependence: z.number().default(0), tolerance: z.number().default(0) }),
        )
        .default({}),
      checkupAge: z.number().default(0),
    })
    .default({
      conditions: {},
      trauma: 0,
      resilience: 40,
      meaning: 50,
      addictions: {},
      checkupAge: 0,
    }),
  /** Inter-faction politics: power, relations, tension, active policies. */
  politics: z
    .object({
      factions: z
        .record(
          z.string(),
          z.object({
            id: z.string(),
            power: z.number().default(50),
            relation: z.record(z.string(), z.number()).default({}),
          }),
        )
        .default({}),
      tension: z.number().default(30),
      policies: z.array(z.string()).default([]),
      playerLean: z.string().nullable().default(null),
    })
    .default({ factions: {}, tension: 30, policies: [], playerLean: null }),
  /** Regional development and the player's place among the regions. */
  regions: z
    .object({
      regions: z
        .record(
          z.string(),
          z.object({
            id: z.string(),
            prosperity: z.number().default(50),
            population: z.number().default(50),
            stability: z.number().default(50),
            development: z.number().default(30),
          }),
        )
        .default({}),
      currentId: z.string().default(""),
      visits: z.record(z.string(), z.number()).default({}),
    })
    .default({ regions: {}, currentId: "", visits: {} }),
  /** Cascading world-event chains: scheduled/fired nodes + lingering tilt. */
  chains: z
    .object({
      active: z
        .array(z.object({ chainId: z.string(), nodeId: z.string(), dueYear: z.number() }))
        .default([]),
      fired: z.array(z.string()).default([]),
      started: z.array(z.string()).default([]),
      marketBias: z.number().default(0),
    })
    .default({ active: [], fired: [], started: [], marketBias: 0 }),
  /** Long-form narrative arcs: stage progress per arc + milestones. */
  narrative: z
    .object({
      arcs: z
        .record(
          z.string(),
          z.object({
            id: z.string(),
            stage: z.number().default(0),
            startedAge: z.number().default(0),
            completedAge: z.number().optional(),
          }),
        )
        .default({}),
      milestones: z.array(z.string()).default([]),
    })
    .default({ arcs: {}, milestones: [] }),
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