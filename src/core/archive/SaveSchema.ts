import z from "zod";

// 存档的完整结构定义。用 Zod schema 统一校验读写两侧：
// 保存时验证写出去的数据是合法的，加载时验证读进来的数据没损坏。
// 如果以后加字段，改这里就行，ArchiveStore 的保存和加载逻辑不需要大动。
export const saveDataSchema = z.object({
  // version 目前是 1，但它是向后兼容的保险丝：
  // 将来如果存档结构有破坏性改动，加载方可以根据版本号做迁移或拒绝处理。
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
    // rangeRecord 的键是事件 id，值是在哪些年龄段触发过。
    // 用 Record<string, string[]> 而不是 Map 是因为 JSON 不支持 Map。
    rangeRecord: z.record(z.string(), z.array(z.string())),
  }),
  achievements: z.array(
    z.object({
      id: z.string(),
      // unlockedAt 是玩家年龄，null 一般不会出现（未解锁的成就根本不会存），
      // 但保留 nullable 以防万一——比如成就定义改了、某个成就突然匹配不到之类。
      unlockedAt: z.number().nullable(),
    }),
  ),
  config: z.object({
    language: z.string(),
    enabledMods: z.array(z.string()),
  }),
  levels: z.object({
    currentLevel: z.string(),
    completedLevels: z.array(z.string()),
  }),
});

export type SaveData = z.infer<typeof saveDataSchema>;

// 存档列表只需要摘要信息，不包含完整数据。
// 用户在选择加载哪个存档时，只需要看到时间、角色名和年龄来做决定。
// 完整的 SaveData 等用户确认加载后再读取，省 I/O 也省内存。
export interface SaveMeta {
  name: string;
  timestamp: string;
  playerName: string;
  age: number;
}
