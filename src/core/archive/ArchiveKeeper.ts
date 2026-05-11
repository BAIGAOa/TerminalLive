import { existsSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { inject, Scope, Scoped } from "di-wise";
import { SaveData, saveDataSchema } from "./SaveSchema.js";
import type Player from "../../world/Player.js";
import type AchievementStore from "../../achievement/AchievementStore.js";
import type ConfigStore from "../store/ConfigStore.js";
import type LevelManager from "../../level/LevelManager.js";
import { VersionProvider } from "../version/VersionProvider.js";
import ModMonitor from "../mod/ModMonitor.js";

@Scoped(Scope.Container)
export class ArchivingKeeper {
  private readonly ARCHIVE_ROOT = join(homedir(), ".archive_live");
  private versionProvider: VersionProvider;

  constructor() {
    this.versionProvider = inject(VersionProvider);
  }

  public save(
    name: string,
    player: Player,
    achievementStore: AchievementStore,
    configStore: ConfigStore,
    levelManager: LevelManager,
    modRegistry: ModMonitor,
  ): void {
    const archiveDir = this.ensureDir(name);
    const modNames = configStore.getEnabledMods();
    this.saveMod(archiveDir, modNames, modRegistry.MOD_ROOT);

    const now = new Date().toISOString();
    const currentHistory = levelManager.getCurrentEventHistory();
    const data: SaveData = {
      version: 3,
      appVersion: this.versionProvider.version,
      timestamp: now,
      player: {
        playerName: player.playerName,
        age: player.age,
        health: player.health,
        height: player.height,
        weight: player.weight,
        angerValue: player.angerValue,
        excitationValue: player.excitationValue,
        depressionValue: player.depressionValue,
        weakValue: player.weakValue,
        fortune: player.fortune,
      },
      history: {
        triggered: Array.from(currentHistory?.getTriggered() ?? []),
        blocked: Array.from(currentHistory?.getBlocked() ?? []),
        rangeRecord: this.serializeRangeRecord(currentHistory),
      },
      achievements: achievementStore
        .getSnapshot()
        .filter((a) => a.unlocked)
        .map((a) => ({ id: a.id, unlockedAt: a.unlockedAt })),
      config: {
        language: configStore.getLanguage(),
        theme: configStore.getTheme(),
        enabledMods: modNames,
      },
      levels: {
        currentLevel: levelManager.getCurrentLevelId() ?? "none",
        completedLevels: [...levelManager.getAllLevels().entries()]
          .filter(([, level]) =>
            levelManager.determineWhetherCheckpointPassed(level),
          )
          .map(([id]) => id),
      },
    };

    saveDataSchema.parse(data);
    writeFileSync(
      join(archiveDir, "archive.json"),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  }

  private saveMod(
    archiveDir: string,
    modNames: string[],
    modRootPath: string,
  ): void {
    if (modNames.length === 0) return;
    const modDest = join(archiveDir, "mods");
    mkdirSync(modDest, { recursive: true });
    for (const modName of modNames) {
      const src = join(modRootPath, modName);
      if (existsSync(src)) {
        cpSync(src, join(modDest, modName), { recursive: true, force: true });
      }
    }
  }

  private ensureDir(name: string): string {
    const dir = join(this.ARCHIVE_ROOT, name);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private serializeRangeRecord(
    history: ReturnType<LevelManager["getCurrentEventHistory"]>,
  ): Record<string, string[]> {
    const record = history?.getRangeKeyRecord();
    const result: Record<string, string[]> = {};
    if (record) {
      for (const [key, set] of record) {
        result[key] = Array.from(set);
      }
    }
    return result;
  }
}
