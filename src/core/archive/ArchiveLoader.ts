import {
  existsSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  cpSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Scope, Scoped } from "di-wise";
import { SaveData, saveDataSchema } from "./SaveSchema.js";
import type Player from "../../world/Player.js";
import type ConfigStore from "../store/ConfigStore.js";
import type LevelManager from "../../level/LevelManager.js";
import type ThemeManager from "../theme/ThemeManager.js";
import type EventHistory from "../../event/EventHistory.js";
import ModMonitor from "../mod/ModMonitor.js";
import AchievementManager from "../../achievement/AchievementManager.js";

@Scoped(Scope.Container)
export class ArchiveLoader {
  private readonly ARCHIVE_ROOT = join(homedir(), ".archive_live");

  public load(
    name: string,
    player: Player,
    achievementManager: AchievementManager,
    configStore: ConfigStore,
    levelManager: LevelManager,
    modRegistry: ModMonitor,
    themeManager: ThemeManager,
    eventHistory: EventHistory,
  ): void {
    const archiveDir = join(this.ARCHIVE_ROOT, name);
    const data = this.readArchiveData(archiveDir);

    this.loadMod(archiveDir, modRegistry.MOD_ROOT);

    configStore.update({
      language: data.config.language,
      theme: data.config.theme ?? "default",
      enabledMods: data.config.enabledMods,
      player: data.player,
      lastLevelId: data.levels.currentLevel,
      completedLevels: data.levels.completedLevels,
    });

    if (data.config.theme) {
      try {
        themeManager.setCurrent(data.config.theme);
      } catch {
        themeManager.setCurrent("default");
      }
    }

    player.applyAttributes(data.player);

    eventHistory.restoreFromArchive(data.history);
    eventHistory.save();

    achievementManager.setState(data.achievements);
    achievementManager.persist();

    levelManager.initCompletedLevels(data.levels.completedLevels);

    console.log("存档已加载，游戏即将重启…… Archive loaded, restarting...");
    setTimeout(() => process.exit(0), 1500);
  }

  private loadMod(archiveDir: string, modRootPath: string): void {
    const modSrcDir = join(archiveDir, "mods");
    if (!existsSync(modSrcDir)) return;

    mkdirSync(modRootPath, { recursive: true });

    let entries;
    try {
      entries = readdirSync(modSrcDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const src = join(modSrcDir, entry.name);
      const dest = join(modRootPath, entry.name);

      if (existsSync(dest)) {
        console.warn(
          `[Mod] 模组 "${entry.name}" 已存在，将被存档中的版本覆盖。 Mod "${entry.name}" already exists and will be overwritten by the archived version.`,
        );
      }
      cpSync(src, dest, { recursive: true, force: true });
    }
  }

  private readArchiveData(archiveDir: string): SaveData {
    const raw = readFileSync(join(archiveDir, "archive.json"), "utf-8");
    try {
      return saveDataSchema.parse(JSON.parse(raw));
    } catch (err) {
      throw new Error(
        "存档不兼容，无法加载。 Archive is incompatible and cannot be loaded.",
      );
    }
  }
}
