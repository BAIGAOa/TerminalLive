import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { Scope, Scoped, inject } from "di-wise";
import AchievementRegistry from "../core/registry/AchievementRegistry.js";
import { Achievement, AchievementSchema } from "./AchievementDefinition.js";

@Scoped(Scope.Container)
export default class AchievementResolver {
  private registry: AchievementRegistry;

  constructor() {
    this.registry = inject(AchievementRegistry);
  }

  private parseFile(path: string): Achievement | null {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      return AchievementSchema.parse(raw);
    } catch (err) {
      console.error(`解析成就文件 ${path} 失败:`, (err as Error).message);
      return null;
    }
  }

  private parseDir(dir: string): Achievement[] {
    const result: Achievement[] = [];
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => extname(f) === ".json");
    } catch {
      console.warn(`成就目录 ${dir} 不存在或无法读取`);
      return result;
    }
    for (const file of files) {
      const ach = this.parseFile(join(dir, file));
      if (ach) result.push(ach);
    }
    return result;
  }

  private buildAchievement(achievements: Achievement[]): void {
    for (const ach of achievements) {
      this.registry.add(ach.category, ach);
    }
  }

  public load(dir: string): void {
    const achievements = this.parseDir(dir);
    this.buildAchievement(achievements);
  }

  /** 供模组编程式注册 */
  public registerSingle(achievement: Achievement): void {
    this.registry.add(achievement.category, achievement);
  }
}