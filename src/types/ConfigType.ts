import z from "zod";

export const DEFAULT_PLAYER_CONFIG = {
  playerName: "Mike",
  age: 0,
  health: 100,
  height: 1.55,
  weight: 45,
  money: 0,
  intelligence: 10,
  social: 10,
  fitness: 10,
  happiness: 60,
  reputation: 0,
  angerValue: 0,
  excitationValue: 0,
  depressionValue: 0,
  weakValue: 0,
} as const;

const PlayerConfigSchema = z.object({
  playerName: z.string().default(DEFAULT_PLAYER_CONFIG.playerName),
  age: z.number().min(0).max(150).default(DEFAULT_PLAYER_CONFIG.age),
  health: z.number().min(0).max(100).default(DEFAULT_PLAYER_CONFIG.health),
  height: z.number().min(0.5).max(3).default(DEFAULT_PLAYER_CONFIG.height),
  weight: z.number().min(1).max(500).default(DEFAULT_PLAYER_CONFIG.weight),
  money: z.number().min(0).default(DEFAULT_PLAYER_CONFIG.money),
  intelligence: z.number().min(0).max(100).default(DEFAULT_PLAYER_CONFIG.intelligence),
  social: z.number().min(0).max(100).default(DEFAULT_PLAYER_CONFIG.social),
  fitness: z.number().min(0).max(100).default(DEFAULT_PLAYER_CONFIG.fitness),
  happiness: z.number().min(0).max(100).default(DEFAULT_PLAYER_CONFIG.happiness),
  reputation: z.number().min(0).max(100).default(DEFAULT_PLAYER_CONFIG.reputation),
  angerValue: z
    .number()
    .min(0)
    .max(100)
    .default(DEFAULT_PLAYER_CONFIG.angerValue),
  excitationValue: z
    .number()
    .min(0)
    .max(100)
    .default(DEFAULT_PLAYER_CONFIG.excitationValue),
  depressionValue: z
    .number()
    .min(0)
    .max(100)
    .default(DEFAULT_PLAYER_CONFIG.depressionValue),
  weakValue: z
    .number()
    .min(0)
    .max(100)
    .default(DEFAULT_PLAYER_CONFIG.weakValue),
  // Transient state carried through config persistence so a loaded save keeps
  // items, relationships, flags and effects (they'd otherwise be stripped).
  effects: z
    .array(z.object({ id: z.string(), remaining: z.number(), stacks: z.number() }))
    .optional(),
  inventory: z
    .array(z.object({ id: z.string(), count: z.number() }))
    .optional(),
  relationships: z.record(z.string(), z.number()).optional(),
  flags: z.array(z.string()).optional(),
  actionPoints: z.number().optional(),
  careerId: z.string().nullable().optional(),
  careerRank: z.number().optional(),
});

const ConfigSchema = z.object({
  language: z.string().default("en_US"),
  theme: z.string().default("default"),
  player: PlayerConfigSchema.default({ ...DEFAULT_PLAYER_CONFIG }),
  enabledMods: z.array(z.string()).default([]),
  /** Built-in plugin ids that are ON. Absent = every built-in plugin on. */
  enabledBuiltinPlugins: z.array(z.string()).optional(),
  lastLevelId: z.string().optional(),
  /** The world to resume into (one world = one life). */
  lastWorldId: z.string().optional(),
  completedLevels: z.array(z.string()).default([]),
  keyBindings: z.record(z.string(), z.string()).default({}),
  traits: z.array(z.string()).default([]),
  /** Accessibility: reduce information density across the UI. */
  simplified: z.boolean().default(false),
});

export type ConfigType = z.infer<typeof ConfigSchema>;
export type PlayerConfigType = z.infer<typeof PlayerConfigSchema>;

export default ConfigSchema;