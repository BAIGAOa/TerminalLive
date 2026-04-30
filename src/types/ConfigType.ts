import z from "zod";

export const DEFAULT_PLAYER_CONFIG = {
  playerName: "Mike",
  age: 0,
  health: 100,
  height: 1.55,
  weight: 45,
  angerValue: 0,
  excitationValue: 0,
  depressionValue: 0,
  weakValue: 0,
  fortune: 0,
} as const;

const PlayerConfigSchema = z.object({
  playerName: z.string().default(DEFAULT_PLAYER_CONFIG.playerName),
  age: z.number().min(0).max(150).default(DEFAULT_PLAYER_CONFIG.age),
  health: z.number().min(0).max(100).default(DEFAULT_PLAYER_CONFIG.health),
  height: z.number().min(0.5).max(3).default(DEFAULT_PLAYER_CONFIG.height),
  weight: z.number().min(1).max(500).default(DEFAULT_PLAYER_CONFIG.weight),
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
  fortune: z.number().min(0).default(DEFAULT_PLAYER_CONFIG.fortune),
});

const ConfigSchema = z.object({
  language: z.string().default("en_US"),
  player: PlayerConfigSchema.default({ ...DEFAULT_PLAYER_CONFIG }),
  enabledMods: z.array(z.string()).default([]),
});

export type ConfigType = z.infer<typeof ConfigSchema>;
export type PlayerConfigType = z.infer<typeof PlayerConfigSchema>;

export default ConfigSchema;
