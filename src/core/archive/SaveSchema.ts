import z from "zod";


export const saveDataSchema = z.object({
  version: z.number(),
  timestamp: z.string(),
  player: z.object({
    playerName: z.string(),
    age: z.number(),
    health: z.number(),
    height: z.number(),
    weight: z.number(),
    angerValue: z.number(),
    excitationValue: z.number(),
    depressionValue: z.number(),
    weakValue: z.number(),
    fortune: z.number(),
  }),
  history: z.object({
    triggered: z.array(z.string()),
    blocked: z.array(z.string()),
    rangeRecord: z.record(z.string(), z.array(z.string())),
  }),
  achievements: z.array(
    z.object({
      id: z.string(),
      unlockedAt: z.number().nullable(),
    }),
  ),
  config: z.object({
    language: z.string(),
    enabledMods: z.array(z.string()),
  }),
});

export type SaveData = z.infer<typeof saveDataSchema>;

/** 存档列表条目，不包含完整数据，但是也够 UI 展示 */
export interface SaveMeta {
  name: string;
  timestamp: string;
  playerName: string;
  age: number;
}