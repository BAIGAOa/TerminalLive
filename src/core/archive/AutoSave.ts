import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { inject } from "../../Container.js";
import { resourcePath } from "../paths.js";
import TypedEventBus from "../TypedEventBus.js";
import WorldManager from "../../worlds/WorldManager.js";
import { SaveData, saveDataSchema } from "./SaveSchema.js";
import { applySaveData, captureSaveData } from "./SaveCodec.js";
import { migrateSave, RawSave } from "./migrations.js";

/**
 * Continuous auto-save of the current life, so quitting mid-game and relaunching
 * resumes exactly where the player left off. Writes are small and driven by game
 * events (turn end, action, choice, level change); death / life-complete clears
 * the slot so a finished life is not resumed.
 *
 * `TL_AUTOSAVE` overrides the file path: a path to use it there, or `off` to
 * disable auto-saving entirely (used by the headless test harnesses).
 */
export default class AutoSave {
  private levelManager: WorldManager;
  private eventBus: TypedEventBus;
  private readonly filePath: string;
  private readonly enabled: boolean;

  constructor() {
    this.levelManager = inject(WorldManager);
    this.eventBus = inject(TypedEventBus);

    const override = process.env.TL_AUTOSAVE;
    this.enabled = override !== "off";
    this.filePath =
      override && override !== "off" ? override : resourcePath("life.json");

    const save = () => this.save();
    this.eventBus.on("turn:ended", save);
    this.eventBus.on("action:performed", save);
    this.eventBus.on("choice:resolved", save);
    this.eventBus.on("level:started", save);
    this.eventBus.on("game:over", () => this.clear());
  }

  /** Path of the auto-save slot (exposed for diagnostics / tests). */
  public get path(): string {
    return this.filePath;
  }

  public exists(): boolean {
    return this.enabled && existsSync(this.filePath);
  }

  /** Snapshot the current life to disk. Skipped when no life is active. */
  public save(): void {
    if (!this.enabled) return;
    if (!this.levelManager.hasActiveWorld()) return;
    const player = this.levelManager.getPlayer();
    // A dead player means the life is over — don't keep resuming a corpse.
    if (player.health <= 0) {
      this.clear();
      return;
    }
    try {
      writeFileSync(this.filePath, JSON.stringify(captureSaveData(), null, 2), "utf8");
    } catch (err) {
      console.warn("[Save] 自动存档失败:", (err as Error).message);
    }
  }

  /** Write a specific save blob (used when loading an archive). */
  public writeData(data: SaveData): void {
    if (!this.enabled) return;
    try {
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[Save] 写入存档失败:", (err as Error).message);
    }
  }

  /**
   * Apply the auto-save in place (no restart). Returns the loaded data so the
   * caller can re-enter the saved level, or null if there was nothing to load.
   */
  public load(): SaveData | null {
    if (!this.exists()) return null;
    try {
      const raw = JSON.parse(readFileSync(this.filePath, "utf8")) as RawSave;
      const data = saveDataSchema.parse(migrateSave(raw));
      if (data.player.health <= 0) {
        this.clear();
        return null;
      }
      if (!applySaveData(data)) {
        // World missing / content version mismatch — start a fresh life.
        this.clear();
        return null;
      }
      return data;
    } catch (err) {
      console.warn("[Save] 自动存档损坏，已忽略:", (err as Error).message);
      this.clear();
      return null;
    }
  }

  public clear(): void {
    if (!this.enabled) return;
    try {
      if (existsSync(this.filePath)) rmSync(this.filePath, { force: true });
    } catch {
      /* ignore */
    }
  }
}
