import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { Scope, Scoped, inject } from "di-wise";
import { SaveData, SaveMeta, saveDataSchema } from "./SaveSchema.js";
import Player from "../../world/Player.js";
import AchievementStore from "../../achievement/AchievementStore.js";
import ConfigStore from "../store/ConfigStore.js";
import LevelManager from "../../level/LevelManager.js";
import TypedEventBus from "../TypedEventBus.js";
import ModRegistry from "../mod/ModRegistry.js";
import ThemeManager from "../theme/ThemeManager.js";


@Scoped(Scope.Container)
export class ArchiveStore {
  readonly SAVE_DIR: string;

  private playerRef: Player | null = null;
  private levelManager: LevelManager;
  private achievementStore: AchievementStore;
  private configStore: ConfigStore;
  private modRegistry: ModRegistry;
  private eventBus: TypedEventBus;
  private themeManager: ThemeManager;

  constructor() {
    this.SAVE_DIR = join(homedir(), ".archive_live");
    this.ensureRootDir();
    this.levelManager = inject(LevelManager);
    this.achievementStore = inject(AchievementStore);
    this.configStore = inject(ConfigStore);
    this.modRegistry = inject(ModRegistry);
    this.eventBus = inject(TypedEventBus);
    this.themeManager = inject(ThemeManager);
  }

  public setPlayer(p: Player): void {
    this.playerRef = p;
  }

  private createDir(dirPath: string, eventId?: string): string {
    try {
      mkdirSync(dirPath, { recursive: true });
    } catch (e) {
      this.eventBus.emit("archive:failedCreateFolder", {
        id: eventId ?? dirPath,
      });
    }
    return dirPath;
  }

  private ensureRootDir(): void {
    this.createDir(this.SAVE_DIR, "root");
  }

  private createArchiveDirectory(name: string): string {
    return this.createDir(join(this.SAVE_DIR, name), name);
  }

  public listSaves(): SaveMeta[] {
    let dirs: string[];
    try {
      dirs = readdirSync(this.SAVE_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }

    const result: SaveMeta[] = [];
    for (const dirName of dirs) {
      try {
        const raw = readFileSync(
          join(this.SAVE_DIR, dirName, "archive.json"),
          "utf-8",
        );
        const data = JSON.parse(raw);
        result.push({
          name: dirName,
          timestamp: data.timestamp ?? "",
          playerName: data.player?.playerName ?? "Unknown",
          age: data.player?.age ?? 0,
        });
      } catch {
        /* 跳过损坏文件 */
      }
    }
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return result;
  }

  public save(id: string) {
    if (!this.playerRef) throw new Error("Player 未初始化");

    const path = this.createArchiveDirectory(id);
    const modPath = this.createDir(join(path, "mods"), `${id}/mods`);

    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      const src = join(this.modRegistry.MOD_ROOT, modName);
      const dest = join(modPath, modName);
      if (existsSync(src)) {
        cpSync(src, dest, { recursive: true, force: true });
      }
    }

    const now = new Date().toISOString();
    const currentHistory = this.levelManager.getCurrentEventHistory();
    const data: SaveData = {
      version: 2,
      timestamp: now,
      player: {
        playerName: this.playerRef.playerName,
        age: this.playerRef.age,
        health: this.playerRef.health,
        height: this.playerRef.height,
        weight: this.playerRef.weight,
        angerValue: this.playerRef.angerValue,
        excitationValue: this.playerRef.excitationValue,
        depressionValue: this.playerRef.depressionValue,
        weakValue: this.playerRef.weakValue,
        fortune: this.playerRef.fortune,
      },
      history: {
        triggered: Array.from(currentHistory?.getTriggered() ?? []),
        blocked: Array.from(currentHistory?.getBlocked() ?? []),
        rangeRecord: this.serializeRangeRecord(),
      },
      achievements: this.achievementStore
        .getSnapshot()
        .filter((a) => a.unlocked)
        .map((a) => ({ id: a.id, unlockedAt: a.unlockedAt })),
      config: {
        language: this.configStore.getLanguage(),
        theme: this.configStore.getTheme(),
        enabledMods: this.configStore.getSnapshot().enabledMods ?? [],
      },
      levels: {
        currentLevel: this.levelManager.getCurrentLevelId() ?? "none",
        completedLevels: [...this.levelManager.getAllLevels().entries()]
          .filter((each) => {
            return this.levelManager.determineWhetherCheckpointPassed(each[1]);
          })
          .map((each) => {
            return each[1].id;
          }),
      },
    };

    saveDataSchema.parse(data);
    writeFileSync(
      join(path, "archive.json"),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
  }

  public async load(archiveName: string): Promise<void> {
    const path = join(this.SAVE_DIR, archiveName);
    const raw = readFileSync(join(path, "archive.json"), "utf-8");
    const data = saveDataSchema.parse(JSON.parse(raw)) as SaveData;

    const archiveMods = join(path, "mods");
    if (existsSync(archiveMods)) {
      const modDirs = readdirSync(archiveMods, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      for (const modName of modDirs) {
        const src = join(archiveMods, modName);
        const dest = join(this.modRegistry.MOD_ROOT, modName);
        cpSync(src, dest, { recursive: true, force: true });
      }
    }

    const currentHistory = this.levelManager.getCurrentEventHistory();

    await this.configStore.update({
      language: data.config.language,
      theme: data.config.theme ?? "default",
      enabledMods: data.config.enabledMods,
      player: data.player,
      lastLevelId: data.levels.currentLevel,
      completedLevels: data.levels.completedLevels,
    });

    if (data.config.theme && this.themeManager.getCurrentId() !== data.config.theme) {
      try {
        this.themeManager.setCurrent(data.config.theme);
      } catch {
        this.themeManager.setCurrent("default");
      }
    }

    this.levelManager.initCompletedLevels(data.levels.completedLevels);
    this.achievementStore.saveFromArchive(data.achievements);
    await this.achievementStore.persist();

    if (currentHistory) {
      currentHistory.restoreFromArchive(data.history);
      currentHistory.save();
    }
  }

  public delete(name: string): void {
    const dirPath = join(this.SAVE_DIR, name);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }

  private serializeRangeRecord(): Record<string, string[]> {
    const record = this.levelManager
      .getCurrentEventHistory()
      ?.getRangeKeyRecord();
    const result: Record<string, string[]> = {};
    if (record) {
      for (const [key, set] of record) {
        result[key] = Array.from(set);
      }
    }
    return result;
  }
}