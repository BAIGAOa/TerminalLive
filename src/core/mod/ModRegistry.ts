import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { Scope, Scoped } from "di-wise";
import { ModManifest } from "./types.js";

// 模组注册表：负责回答"有哪些模组""模组放在哪""模组里有什么文件"这些问题。
// 它只管路径和目录结构，不负责加载或执行模组代码。
// 统一放在 ~/.mod_live/ 下，不用在项目目录里翻，用户和模组开发者都好找。
@Scoped(Scope.Container)
export default class ModRegistry {
  public readonly MOD_ROOT: string;

  constructor() {
    this.MOD_ROOT = join(homedir(), ".mod_live");
    this.ensureRoot();
  }

  private ensureRoot(): void {
    if (!existsSync(this.MOD_ROOT)) {
      mkdirSync(this.MOD_ROOT, { recursive: true });
    }
  }

  // 扫描一级子目录，忽略隐藏文件夹（以 . 开头的）。
  // 每个子目录对应一个模组，不递归——模组内部结构由路径方法自己拼接。
  public getAllMods(): string[] {
    try {
      return readdirSync(this.MOD_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  public getModPath(modName: string): string {
    return join(this.MOD_ROOT, modName);
  }

  public getModEventsPath(modName: string): string {
    return join(this.MOD_ROOT, modName, "events");
  }

  public getModLanguagePath(modName: string): string {
    return join(this.MOD_ROOT, modName, "language");
  }

  // 只要 events 或 language 目录之一存在就算合法。
  // 纯事件模组、纯翻译模组、两者都有的混合模组都是有效用例。
  public isValid(modName: string): boolean {
    const p = this.getModPath(modName);
    if (!existsSync(p)) return false;
    const hasEvents = existsSync(this.getModEventsPath(modName));
    const hasLang = existsSync(this.getModLanguagePath(modName));
    return hasEvents || hasLang;
  }

  public getModMainPath(modName: string) {
    return join(this.MOD_ROOT, modName, "index.js");
  }

  // 模组元数据可能缺失，返回 null 而不是抛异常。
  // 调用方可以优雅降级（比如在列表里显示"未知模组"）。
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