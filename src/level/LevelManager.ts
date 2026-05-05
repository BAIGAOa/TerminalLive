import { Scope, Scoped, inject } from "di-wise";
import Level from "./Level.js";
import LevelLoader from "./LevelLoader.js";
import Player from "../world/Player.js";
import EventHistory from "../event/EventHistory.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";
import ModRegistry from "../core/mod/ModRegistry.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import DifficultyRegistry from "./registry/DifficultyRegistry.js";
import TypedEventBus from "../core/TypedEventBus.js";

type Listener = () => void;

@Scoped(Scope.Container)
export default class LevelManager {
  private levelLoader: LevelLoader;
  private modPluginLoader: ModPluginLoader;
  private modRegistry: ModRegistry;
  private configStore: ConfigStore;
  private eventBus: TypedEventBus;

  private levels: Map<string, Level> = new Map();
  private completedLevels = new Set<string>();
  private _current: Level | null = null;

  public lastPlayedLevelId: string | null = null;

  private player: Player | null = null;
  private listeners = new Set<Listener>();

  private difficultyRegistry: DifficultyRegistry;

  private version: number = 0;

  constructor() {
    this.levelLoader = inject(LevelLoader);
    this.modPluginLoader = inject(ModPluginLoader);
    this.modRegistry = inject(ModRegistry);
    this.configStore = inject(ConfigStore);
    this.eventBus = inject(TypedEventBus);
    this.difficultyRegistry = inject(DifficultyRegistry);
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public initCompletedLevels(levelId: string[] | undefined) {
    this.completedLevels = new Set(levelId ?? []);
    this.notify();
  }

  public isLevelCompleted(levelId: string) {
    return this.completedLevels.has(levelId);
  }

  public getAllLevels() {
    return this.levels;
  }

  public get current(): Level {
    if (!this._current) throw new Error("没有激活的关卡");
    return this._current;
  }

  public get currentPlayer(): Player {
    return this.current.player;
  }

  public setPlayer(player: Player): void {
    this.player = player;
  }

  public loadAllLevels(): void {
    if (!this.player) throw new Error("请先调用 setPlayer");

    // 加载内置关卡
    const builtinLevels = this.levelLoader.loadAll(this.player);
    for (const level of builtinLevels) {
      if (this.levels.has(level.id)) {
        console.warn(`内置关卡 ID "${level.id}" 冲突，已跳过`);
        continue;
      }
      this.levels.set(level.id, level);
      this.difficultyRegistry.register(level.difficultyIdentification, level);
    }

    // 加载所有已启用模组的扩展关卡
    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (!this.modRegistry.isValid(modName)) continue;

      const modLevelsPath = join(
        this.modRegistry.getModPath(modName),
        "levels",
      );
      const modLevels = this.levelLoader.loadDir(modLevelsPath, this.player);

      for (const level of modLevels) {
        if (this.levels.has(level.id)) {
          console.warn(
            `模组 "${modName}" 的关卡 ID "${level.id}" 冲突，已跳过`,
          );
          continue;
        }
        this.levels.set(level.id, level);
        this.difficultyRegistry.register(level.difficultyIdentification, level);
      }
    }
  }

  public start(id: string): void {
    const level = this.levels.get(id);
    if (!level) throw new Error(`关卡 "${id}" 未加载`);

    if (this._current) {
      this._current.dispose();
    }

    this._current = level;

    // 加载事件到当前关卡
    this.loadEventsFor(level);

    this.modPluginLoader.setPlayer(level.player);
    this.eventBus.emit("level:started", { levelId: id });
    this.lastPlayedLevelId = null;
    this.configStore.update({ lastLevelId: undefined });

    this.notify();
  }

  public update(): void {
    this.current.update();
    this.eventBus.emit("player:updated");
    this.notify();
  }

  public getCurrentEventHistory(): EventHistory | null {
    return this._current?.eventHistory ?? null;
  }

  public getPlayer() {
    if (!this.player)
      throw new TypeError(
        "玩家还没有初始化 The player has not been initialized",
      );
    return this.player;
  }

  public getCurrentLogStore() {
    return this._current?.logStore ?? null;
  }

  public getCurrentLevelId() {
    return this._current?.id ?? null;
  }

  /** 切换到下一关 */
  public goToNextLevel(): boolean {
    if (!this._current) return false;
    const nextId = this._current.nextLevel;
    if (nextId === "none") return false;
    if (!this.levels.has(nextId)) return false;
    this.start(nextId);
    return true;
  }

  private loadEventsFor(level: Level): void {
    const builtinDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "resource",
      "events",
    );
    level.eventLoader.loadDir(builtinDir);

    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (this.modRegistry.isValid(modName)) {
        level.eventLoader.loadDir(this.modRegistry.getModEventsPath(modName));
      }
    }
  }

  // 判断这个关卡是否通过
  public determineWhetherCheckpointPassed(level: Level) {
    const p = this.player;

    if (!p) throw new Error(`玩家未加载无法判断关卡${level.id}是否通过`);

    const pass = level.nextLevelUnlock.every((each) =>
      each.customsClearance(p),
    );

    return pass;
  }

  public getSnapshot = (): number => this.version;

  private notify(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  public restoreLevel(levelId: string, player: Player): void {
    const level = this.levels.get(levelId);
    if (!level) {
      this.eventBus.emit("level:loadFailed", { levelId });
      return;
    }
    this._current = level;
    level.player = player;
    if (level.eventCenter.getAllRanges().length === 0) {
      this.loadEventsFor(level);
    }
    this.modPluginLoader.setPlayer(player);
    this.eventBus.emit("level:started", { levelId });
    this.notify();
  }
}
