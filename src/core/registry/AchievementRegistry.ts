import { Scope, Scoped } from "di-wise";
import BaseRegistry from "./BaseRegistry.js";
import { Achievement } from "../../achievement/AchievementDefinition.js";

@Scoped(Scope.Container)
export default class AchievementRegistry extends BaseRegistry<Map<string, Achievement>> {
  private readonly allIds = new Set<string>();

  public add(category: string, achievement: Achievement): void {
    if (this.allIds.has(achievement.id)) {
      throw new Error(`成就 ID "${achievement.id}" 已存在，不可重复注册`);
    }
    this.allIds.add(achievement.id);

    if (!this.has(category)) {
      this.register(category, new Map());
    }
    this.get(category).set(achievement.id, achievement);
  }

  public getByCategory(category: string): Achievement[] {
    if (!this.has(category)) return [];
    return Array.from(this.get(category).values());
  }

  public getAllAchievements(): Achievement[] {
    const result: Achievement[] = [];
    for (const map of this.getMap().values()) {
      for (const ach of map.values()) {
        result.push(ach);
      }
    }
    return result;
  }

  public getCategories(): string[] {
    return this.getKeys();
  }
}