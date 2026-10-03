import { inject } from "../Container.js";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import AchievementRegistry from "../core/registry/AchievementRegistry.js";
import { Achievement, AchievementSchema } from "./AchievementDefinition.js";

export default class AchievementResolver {
  private registry: AchievementRegistry;

  constructor() {
    this.registry = inject(AchievementRegistry);
  }

  private parseFile(path: string): Achievement[] {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      const entries = Array.isArray(raw) ? raw : [raw];
      return entries.map((e) => AchievementSchema.parse(e));
    } catch (err) {
      console.error(`解析成就文件 ${path} 失败:`, (err as Error).message);
      return [];
    }
  }

  private parseDir(dir: string): Achievement[] {
    const result: Achievement[] = [];
    let files: string[];
    try {
      // unlocked.json holds save state, not achievement definitions.
      files = readdirSync(dir).filter(
        (f) => extname(f) === ".json" && f !== "unlocked.json",
      );
    } catch {
      console.warn(`成就目录 ${dir} 不存在或无法读取`);
      return result;
    }
    for (const file of files) {
      result.push(...this.parseFile(join(dir, file)));
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