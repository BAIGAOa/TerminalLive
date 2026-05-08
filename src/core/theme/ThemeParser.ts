import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Scope, Scoped, inject } from "di-wise";
import ThemeCenter from "./ThemeCenter.js";
import { ThemeSchema, Theme } from "./ThemeDefinition.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

@Scoped(Scope.Container)
export default class ThemeParser {
  private themeCenter: ThemeCenter;

  constructor() {
    this.themeCenter = inject(ThemeCenter);
  }

  private parseThemeJson(dirPath: string): Theme[] {
    const themes: Theme[] = [];
    let files: string[];
    try {
      files = readdirSync(dirPath).filter((f) => extname(f) === ".json");
    } catch {
      console.warn(`主题目录 ${dirPath} 不存在或无法读取`);
      return [];
    }
    for (const file of files) {
      const filePath = join(dirPath, file);
      try {
        const raw = JSON.parse(readFileSync(filePath, "utf-8"));
        const parsed = ThemeSchema.parse(raw);
        themes.push(parsed);
      } catch (err) {
        console.error(`解析主题文件 ${filePath} 失败:`, (err as Error).message);
      }
    }
    return themes;
  }

  private buildTheme(themes: Theme[]): void {
    for (const theme of themes) {
      this.themeCenter.addTheme(theme);
    }
  }

  public load(dirPath?: string): void {
    const path = dirPath ?? join(_dirname, "..", "..", "..", "resource", "themes");
    const themes = this.parseThemeJson(path);
    this.buildTheme(themes);
  }
}