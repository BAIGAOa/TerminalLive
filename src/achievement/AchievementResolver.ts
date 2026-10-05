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
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf-8"));
    } catch (err) {
      console.error(`解析成就文件 ${path} 失败:`, (err as Error).message);
      return [];
    }
    // Parse entry-by-entry: one bad achievement must not discard the file.
    const entries = Array.isArray(raw) ? raw : [raw];
    const out: Achievement[] = [];
    for (const entry of entries) {
      const parsed = AchievementSchema.safeParse(entry);
      if (parsed.success) out.push(parsed.data);
      else
        console.warn(
          `[achievement] 跳过 ${path} 中的无效条目:`,
          parsed.error.message,
        );
    }
    return out;
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
      // A duplicate id (e.g. a mod re-declaring a built-in) must not abort boot.
      try {
        this.registry.add(ach.category, ach);
      } catch (err) {
        console.warn(`[achievement] 跳过重复 id "${ach.id}":`, (err as Error).message);
      }
    }
  }

  public load(dir: string): void {
    const achievements = this.parseDir(dir);
    this.buildAchievement(achievements);
  }

  /** 供模组编程式注册 */
  public registerSingle(achievement: Achievement): void {
    try {
      this.registry.add(achievement.category, achievement);
    } catch (err) {
      console.warn(
        `[achievement] 跳过重复 id "${achievement.id}":`,
        (err as Error).message,
      );
    }
  }
}