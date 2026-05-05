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

// 存档管理：负责保存、加载、列出和删除存档文件。
// 存档目录放在 ~/.archive_live/ 下，和模组目录 ~/.mod_live/ 平级，
// 用户备份或迁移时这两坨数据一起搬就行。

@Scoped(Scope.Container)
export class ArchiveStore {
  readonly SAVE_DIR: string;

  private playerRef: Player | null = null;
  private levelManager: LevelManager;
  private achievementStore: AchievementStore;
  private configStore: ConfigStore;
  private modRegistry: ModRegistry;
  private eventBus: TypedEventBus;

  constructor() {
    this.SAVE_DIR = join(homedir(), ".archive_live");
    this.ensureRootDir();
    this.levelManager = inject(LevelManager);
    this.achievementStore = inject(AchievementStore);
    this.configStore = inject(ConfigStore);
    this.modRegistry = inject(ModRegistry);
    this.eventBus = inject(TypedEventBus);
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

  /**
   * 创建存档根目录，用于初始化
   */
  private ensureRootDir(): void {
    this.createDir(this.SAVE_DIR, "root");
  }

  /**
   * 创建存档目录
   */
  private createArchiveDirectory(name: string): string {
    return this.createDir(join(this.SAVE_DIR, name), name);
  }

  /**
   * 列出所有存档目录
   */
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

  /**
   * 保存当前游戏状态为一份新存档。
   * 同时复制已启用的模组到存档内的 mods 目录，使存档自包含。
   */
  public save(id: string) {
    if (!this.playerRef) throw new Error("Player 未初始化");

    // 创建存档目录
    const path = this.createArchiveDirectory(id);
    // 创建存档内的 mods 目录
    const modPath = this.createDir(join(path, "mods"), `${id}/mods`);

    // 复制已启用的模组
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

  /**
   * 从存档目录加载游戏状态。
   * 先还原模组，再恢复配置、成就、事件历史。
   */
  public async load(archiveName: string): Promise<void> {
    const path = join(this.SAVE_DIR, archiveName);
    const raw = readFileSync(join(path, "archive.json"), "utf-8");
    const data = saveDataSchema.parse(JSON.parse(raw)) as SaveData;

    // 将存档内的 mods 复制到 ~/.mod_live，覆盖已存在的同名模组
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
      enabledMods: data.config.enabledMods,
      player: data.player,
      lastLevelId: data.levels.currentLevel,
      completedLevels: data.levels.completedLevels,
    });

    this.levelManager.initCompletedLevels(data.levels.completedLevels);
    this.achievementStore.saveFromArchive(data.achievements);
    await this.achievementStore.persist();

    if (currentHistory) {
      currentHistory.restoreFromArchive(data.history);
      currentHistory.save();
    }
  }

  /**
   * 删除整个存档目录
   */
  public delete(name: string): void {
    const dirPath = join(this.SAVE_DIR, name);
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * 将 Map<string, Set<string>> 序列化为普通对象
   */
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
