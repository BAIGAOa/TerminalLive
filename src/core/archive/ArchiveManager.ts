import { inject } from "../../Container.js";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ArchiveLoader } from "./ArchiveLoader.js";
import { SaveMeta } from "./SaveSchema.js";
import ConfigStore from "../store/ConfigStore.js";
import { ArchivingKeeper } from "./ArchiveKeeper.js";
import { isValidSaveName, resolveWithin } from "./saveName.js";

type Listener = () => void;

export class ArchiveManager {
  private readonly ARCHIVE_ROOT = join(homedir(), ".archive_live");

  private keeper: ArchivingKeeper;
  private loader: ArchiveLoader;
  private configStore: ConfigStore;

  private listeners = new Set<Listener>();

  constructor() {
    this.keeper = inject(ArchivingKeeper);
    this.loader = inject(ArchiveLoader);
    this.configStore = inject(ConfigStore);
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
      const dir = join(this.ARCHIVE_ROOT, dirName);
      try {
        const raw = readFileSync(join(dir, "archive.json"), "utf-8");
        const data = JSON.parse(raw);
        result.push({
          name: dirName,
          timestamp: data.timestamp ?? "",
          playerName: data.player?.playerName ?? "Unknown",
          age: data.player?.age ?? 0,
          appVersion: data.appVersion ?? "0.0.0",
          mtimeMs: statSync(dir).mtimeMs,
        });
      } catch {
        // 跳过损坏的存档文件
      }
    }

    result.sort((a, b) => b.mtimeMs - a.mtimeMs);

    return result;
  }

  public save(name: string): void {
    if (!isValidSaveName(name)) {
      throw new Error(`不合法的存档名: ${JSON.stringify(name)}`);
    }
    this.keeper.save(name, this.configStore);
    this.emitChange();
  }

  public load(name: string): void {
    this.loader.load(name);
  }

  public delete(name: string): void {
    const dir = resolveWithin(this.ARCHIVE_ROOT, name);
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
