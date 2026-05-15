import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Scope, Scoped, inject } from "di-wise";
import { ArchiveLoader } from "./ArchiveLoader.js";
import { SaveMeta } from "./SaveSchema.js";
import ConfigStore from "../store/ConfigStore.js";
import LevelManager from "../../level/LevelManager.js";
import ThemeManager from "../theme/ThemeManager.js";
import EventHistory from "../../event/EventHistory.js";
import { ArchivingKeeper } from "./ArchiveKeeper.js";
import ModMonitor from "../mod/ModMonitor.js";
import AchievementManager from "../../achievement/AchievementManager.js";

type Listener = () => void;

@Scoped(Scope.Container)
export class ArchiveManager {
  private readonly ARCHIVE_ROOT = join(homedir(), ".archive_live");

  private keeper: ArchivingKeeper;
  private loader: ArchiveLoader;
  private achievementManager: AchievementManager;
  private configStore: ConfigStore;
  private levelManager: LevelManager;
  private modRegistry: ModMonitor;
  private themeManager: ThemeManager;
  private eventHistory: EventHistory;

  private listeners = new Set<Listener>();

  constructor() {
    this.keeper = inject(ArchivingKeeper);
    this.loader = inject(ArchiveLoader);
    this.achievementManager = inject(AchievementManager);
    this.configStore = inject(ConfigStore);
    this.levelManager = inject(LevelManager);
    this.modRegistry = inject(ModMonitor);
    this.themeManager = inject(ThemeManager);
    this.eventHistory = inject(EventHistory);
  }

  public listSaves(): SaveMeta[] {
    if (!existsSync(this.ARCHIVE_ROOT)) return [];

    let dirs: string[];
    try {
      dirs = readdirSync(this.ARCHIVE_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }

    const result: SaveMeta[] = [];
    for (const dirName of dirs) {
      const archiveFile = join(this.ARCHIVE_ROOT, dirName, "archive.json");
      try {
        const raw = readFileSync(archiveFile, "utf-8");
        const data = JSON.parse(raw);
        result.push({
          name: dirName,
          timestamp: data.timestamp ?? "",
          playerName: data.player?.playerName ?? "Unknown",
          age: data.player?.age ?? 0,
          appVersion: data.appVersion ?? "0.0.0",
        });
      } catch {
        // 跳过损坏的存档文件
      }
    }

    result.sort((a, b) => {
      const ta = statSync(join(this.ARCHIVE_ROOT, a.name)).mtimeMs;
      const tb = statSync(join(this.ARCHIVE_ROOT, b.name)).mtimeMs;
      return tb - ta;
    });

    return result;
  }

  public save(name: string): void {
    const player = this.levelManager.getPlayer();
    this.keeper.save(
      name,
      player,
      this.achievementManager,
      this.configStore,
      this.levelManager,
      this.modRegistry,
    );
    this.emitChange();
  }

  public load(name: string): void {
    const player = this.levelManager.getPlayer();
    this.loader.load(
      name,
      player,
      this.achievementManager,
      this.configStore,
      this.levelManager,
      this.modRegistry,
      this.themeManager,
      this.eventHistory,
    );
  }

  public delete(name: string): void {
    const dir = join(this.ARCHIVE_ROOT, name);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      this.emitChange();
    }
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emitChange(): void {
    this.listeners.forEach((fn) => fn());
  }
}
