import { inject, Scope, Scoped } from "di-wise";
import Game from "./Game.js";
import ConfigStore from "./store/ConfigStore.js";
import Player from "../world/Player.js";
import ModLoader from "./mod/ModLoader.js";
import EventTypes from "./mod/EventTypes.js";
import ModPluginLoader from "./mod/ModPluginLoader.js";
import ConsoleStore from "./console/ConsoleStore.js";
import { container } from "../Container.js";
import EventHistory from "../event/EventHistory.js";
import { ArchiveManager } from "./archive/ArchiveManager.js";
import { registerBuiltinRegistrations } from "../level/BuiltinRegistrations.js";
import LevelManager from "../level/LevelManager.js";
import Conditions from "../content/Conditions.js";
import GameStatus from "../content/GameStatus.js";
import ThemeParser from "./theme/ThemeParser.js";
import ThemeManager from "./theme/ThemeManager.js";
import { VersionProvider } from "./version/VersionProvider.js";
import Commands from "../content/Commands.js";
import ModMonitor from "./mod/ModMonitor.js";
import AchievementManager from "../achievement/AchievementManager.js";
import AchievementResolver from "../achievement/AchievementResolver.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

@Scoped(Scope.Container)
export default class GameInitialization {
  public configStore: ConfigStore;
  public game: Game;
  public modLoader: ModLoader;
  public modRegistry: ModMonitor;
  public player!: Player;
  public eventHistory: EventHistory;
  public archiveManager: ArchiveManager;
  public modPluginLoader: ModPluginLoader;
  public levelManager: LevelManager;

  constructor() {
    this.configStore = inject(ConfigStore);
    this.game = inject(Game);
    this.modLoader = inject(ModLoader);
    this.modRegistry = inject(ModMonitor);
    this.eventHistory = inject(EventHistory);
    this.archiveManager = inject(ArchiveManager);
    this.modPluginLoader = inject(ModPluginLoader);
    this.levelManager = inject(LevelManager);
  }

  private async configurationInitialization() {
    await this.configStore.init();
  }

  private restoreLevelProgress() {
    const lastLevelId = this.configStore.getSnapshot().lastLevelId;
    if (lastLevelId && lastLevelId !== "none") {
      this.levelManager.lastPlayedLevelId = lastLevelId;
    }
  }

  private loadPlayer(): void {
    this.player = new Player(this.configStore.getPlayerConfig());
  }

  private loadContent(): void {
    EventTypes.registerAll();
    this.modLoader.load();
    Conditions.load();
    GameStatus.load();
  }

  private initThemes(): void {
    const themeParser = container.resolve(ThemeParser);
    themeParser.load();

    const themeManager = container.resolve(ThemeManager);
    const savedTheme = this.configStore.getTheme();
    if (themeManager.getCurrentId() !== savedTheme) {
      try {
        themeManager.setCurrent(savedTheme);
      } catch {
        themeManager.setCurrent("default");
        this.configStore.setTheme("default");
      }
    }
  }

  private async initAchievementSystem() {
    const achievementResolver = container.resolve(AchievementResolver);
    const achievementManager = container.resolve(AchievementManager);

    const builtinAchDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "resource",
      "achievement",
    );
    achievementResolver.load(builtinAchDir);

    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (this.modRegistry.isValid(modName)) {
        const modAchPath = this.modRegistry.getModAchievementsPath(modName);
        achievementResolver.load(modAchPath);
      }
    }

    await achievementManager.load();
    achievementManager.bindPlayer(this.player);
  }

  public async init() {
    container.resolve(ConsoleStore);
    container.resolve(VersionProvider);
    await this.configurationInitialization();
    this.loadPlayer();
    this.eventHistory.load();
    this.loadContent();

    registerBuiltinRegistrations();
    const levelManager = container.resolve(LevelManager);
    levelManager.setPlayer(this.player);

    this.modPluginLoader.setPlayer(this.player);
    this.modPluginLoader.loadEnabled();
    levelManager.loadAllLevels();

    this.initThemes();
    Commands.load();

    await this.initAchievementSystem();

    this.restoreLevelProgress();
    this.levelManager.initCompletedLevels(
      this.configStore.getSnapshot().completedLevels,
    );
    return this;
  }
}