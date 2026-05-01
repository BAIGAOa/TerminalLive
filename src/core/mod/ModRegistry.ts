import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { Scope, Scoped } from "di-wise";
import { ModManifest } from "./types.js";

@Scoped(Scope.Container)
export default class ModRegistry {
  public readonly MOD_ROOT: string;

  constructor() {
    this.MOD_ROOT = join(homedir(), ".mod_live");
    this.ensureRoot();
  }

  /**确保~/.mod_live 存在*/
  private ensureRoot(): void {
    if (!existsSync(this.MOD_ROOT)) {
      mkdirSync(this.MOD_ROOT, { recursive: true });
    }
  }

  /**获取所有mod名称*/
  public getAllMods(): string[] {
    try {
      return readdirSync(this.MOD_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  /**mod根路径*/
  public getModPath(modName: string): string {
    return join(this.MOD_ROOT, modName);
  }

  /**mod事件目录*/
  public getModEventsPath(modName: string): string {
    return join(this.MOD_ROOT, modName, "events");
  }

  /**mod语言目录*/
  public getModLanguagePath(modName: string): string {
    return join(this.MOD_ROOT, modName, "language");
  }

  /** 至少存在 events或 language目录 */
  public isValid(modName: string): boolean {
    const p = this.getModPath(modName);
    if (!existsSync(p)) return false;
    const hasEvents = existsSync(this.getModEventsPath(modName));
    const hasLang = existsSync(this.getModLanguagePath(modName));
    return hasEvents || hasLang;
  }

  /**读取模组的入口文件路径*/
  public getModMainPath(modName: string) {
    return join(this.MOD_ROOT, modName, "index.js");
  }

  /**读取模组的mod.json配置文件*/
  public getModManifest(modName: string): ModManifest | null {
    try {
      const raw = readFileSync(
        join(this.MOD_ROOT, modName, "mod.json"),
        "utf-8",
      );
      return JSON.parse(raw) as ModManifest;
    } catch {
      return null;
    }
  }
}
