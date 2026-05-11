import { inject, Scope, Scoped } from "di-wise";
import Game from "./Game.js";
import ConfigStore from "./store/ConfigStore.js";
import KeysCenter from "./keys/KeysCenter.js";
import KeyboardMonitor from "./keys/KeyboardMonitor.js";
import Player from "../world/Player.js";
import Keys from "../content/Keys.js";
import Achievements from "../content/Achievements.js";
import AchievementStore from "../achievement/AchievementStore.js";
import ModLoader from "./mod/ModLoader.js";
import EventTypes from "./mod/EventTypes.js";
import ModPluginLoader from "./mod/ModPluginLoader.js";
import ConsoleStore from "./console/ConsoleStore.js";
import { container } from "../Container.js";
import { Screens } from "../content/Screens.js";
import EventHistory from "../event/EventHistory.js";
import { ArchiveManager } from "./archive/ArchiveManager.js";
import { registerBuiltinRegistrations } from "../level/BuiltinRegistrations.js";
import LevelManager from "../level/LevelManager.js";
import Conditions from "../content/Conditions.js";
import GameStatus from "../content/GameStatus.js";
import { KeyboardManager } from "./keys/KeyBoardManager.js";
import ThemeParser from "./theme/ThemeParser.js";
import ThemeManager from "./theme/ThemeManager.js";
import { VersionProvider } from "./version/VersionProvider.js";
import Commands from "../content/Commands.js";
import ModMonitor from "./mod/ModMonitor.js";

@Scoped(Scope.Container)
export default class GameInitialization {
  public configStore: ConfigStore;
  public game: Game;
  public keysCenter: KeysCenter;
  public achievementStore: AchievementStore;
  public modLoader: ModLoader;
  public modRegistry: ModMonitor;
  public monitor!: KeyboardMonitor;
  public player!: Player;
  public eventHistory: EventHistory;
  public archiveManager: ArchiveManager;
  public modPluginLoader: ModPluginLoader;
  public levelManager: LevelManager;
  public keyBoardManager: KeyboardManager;

  constructor() {
    this.configStore = inject(ConfigStore);
    this.game = inject(Game);
    this.keysCenter = inject(KeysCenter);
    this.achievementStore = inject(AchievementStore);
    this.modLoader = inject(ModLoader);
    this.modRegistry = inject(ModMonitor);
    this.eventHistory = inject(EventHistory);
    this.archiveManager = inject(ArchiveManager);
    this.modPluginLoader = inject(ModPluginLoader);
    this.levelManager = inject(LevelManager);
    this.keyBoardManager = inject(KeyboardManager);
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
    Screens.load();
    Keys.load();
    Achievements.load();
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

  private async initMonitor(): Promise<void> {
    this.monitor = await KeyboardMonitor.create("keys.json", this.keysCenter);
  }

  private async initAchievementSystem() {
    this.achievementStore.bindPlayer(this.player);
    await this.achievementStore.load();
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
    // 指令的加载需要主题也成功加载
    Commands.load();

    await this.initMonitor();

    this.keyBoardManager.setDefaultHandler((input, key) =>
      this.monitor.handleInput(input, key),
    );

    await this.initAchievementSystem();

    this.restoreLevelProgress();
    this.levelManager.initCompletedLevels(
      this.configStore.getSnapshot().completedLevels,
    );
    return this;
  }
}
