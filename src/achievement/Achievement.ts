import { AchievementCategory } from "../types/AchievementCategory.js";
import Player from "../world/Player.js";

// 成就的解锁条件用联合类型定义三种：
//   - incidentTriggered：某个事件发生过就行，这是最常见的情况（"上学"事件触发过）
//   - statThreshold：玩家属性达到某个数值（"健康值小于 20"）
//   - custom：兜底方案，给模组和未来扩展留个口子。前两种覆盖不了的条件都走这个。
//
// 每次检查都在 checkAll() 里用 every 跑一遍，全部通过才解锁。
export type AchievementCondition =
  | { type: 'incidentTriggered'; incidentId: string }
  | { type: 'statThreshold'; stat: keyof Player; value: number; comparator: 'gte' | 'lte' }
  | { type: 'custom'; check: (player: Player, triggeredEvents: Set<string>) => boolean }

export interface AchievementConfig {
  id: string
  nameKey: string
  // remindKey 和 nameKey 分开，是因为成就弹出的通知文字可能跟列表里显示的不一样。
  // 弹出时一般只有两三行空间，需要更短；列表里可以完整描述。不填就复用 nameKey。
  remindKey?: string
  category?: AchievementCategory
  descriptionKey: string
  conditions: AchievementCondition[]
  // hidden 成就列表里显示 ???，解锁后才揭示。防止剧透，也激励探索。
  hidden?: boolean
}

export class Achievement {
  public readonly id: string
  public readonly nameKey: string
  public readonly remindKey: string
  public readonly category: AchievementCategory
  public readonly descriptionKey: string
  public readonly conditions: AchievementCondition[]
  public readonly hidden: boolean
  // 运行时的可变状态，不放在 config 里因为 config 是「定义」，这两个是「进度」
  public unlocked: boolean = false
  // unlockedAt 记录的是玩家年龄，而不是时间戳。
  // 因为游戏内的时间单位是「年龄」不是真实时钟，用年龄才能跟事件日志对齐。
  public unlockedAt: number | null = null

  constructor(config: AchievementConfig) {
    this.id = config.id
    this.nameKey = config.nameKey
    this.remindKey = config.remindKey ?? this.nameKey
    this.category = config.category ?? AchievementCategory.base
    this.descriptionKey = config.descriptionKey
    this.conditions = config.conditions
    this.hidden = config.hidden ?? false
  }
}