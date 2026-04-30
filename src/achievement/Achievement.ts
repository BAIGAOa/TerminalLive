import { AchievementCategory } from "../types/AchievementCategory.js";
import Player from "../world/Player.js";

export type AchievementCondition =
    | { type: 'incidentTriggered'; incidentId: string }
    | { type: 'statThreshold'; stat: keyof Player; value: number; comparator: 'gte' | 'lte' }
    | { type: 'custom'; check: (player: Player, triggeredEvents: Set<string>) => boolean }

export interface AchievementConfig {
    id: string
    nameKey: string
    remindKey?: string
    category?: AchievementCategory
    descriptionKey: string
    conditions: AchievementCondition[]
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
    public unlocked: boolean = false
    public unlockedAt: number | null = null

    constructor(config: AchievementConfig) {
        this.id = config.id
        this.nameKey = config.nameKey
        //默认使用nameKey
        this.remindKey = config.remindKey ?? this.nameKey
        this.category = config.category ?? AchievementCategory.base
        this.descriptionKey = config.descriptionKey
        this.conditions = config.conditions
        this.hidden = config.hidden ?? false
    }
}
