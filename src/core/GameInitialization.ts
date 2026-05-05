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
import ModRegistry from "./mod/ModRegistry.js";
import ModPluginLoader from "./mod/ModPluginLoader.js";
import ConsoleStore from "./console/ConsoleStore.js";
import { container } from "../Container.js";
import { Screens } from "../content/Screens.js";
import EventHistory from "../event/EventHistory.js";
import { ArchiveStore } from "./archive/ArchiveStore.js";
import { registerBuiltinRegistrations } from "../level/BuiltinRegistrations.js";
import LevelManager from "../level/LevelManager.js";
import Conditions from "../content/Conditions.js";

@Scoped(Scope.Container)
export default class GameInitialization {
  public configStore: ConfigStore;
  public game: Game;
  public keysCenter: KeysCenter;
  public achievementStore: AchievementStore;
  public modLoader: ModLoader;
  public modRegistry: ModRegistry;

  public monitor!: KeyboardMonitor;
  public player!: Player;
  public eventHistory: EventHistory;
  public archiveStore: ArchiveStore;

  public modPluginLoader: ModPluginLoader;

  public levelManager: LevelManager;

  constructor() {
    this.configStore = inject(ConfigStore);
    this.game = inject(Game);
    this.keysCenter = inject(KeysCenter);
    this.achievementStore = inject(AchievementStore);
    this.modLoader = inject(ModLoader);
    this.modRegistry = inject(ModRegistry);
    this.eventHistory = inject(EventHistory);
    this.archiveStore = inject(ArchiveStore);
    this.modPluginLoader = inject(ModPluginLoader);
    this.levelManager = inject(LevelManager);
  }

  //初始化配置，用于从本地获取配置并加载
  private async configurationInitialization() {
    await this.configStore.init();
  }

  private restoreLevelProgress() {
    const lastLevelId = this.configStore.getSnapshot().lastLevelId;
    if (lastLevelId && lastLevelId !== "none") {
      this.levelManager.lastPlayedLevelId = lastLevelId;
    }
  }

  //加载创建玩家全局实例
  private loadPlayer(): void {
    this.player = new Player(this.configStore.getPlayerConfig());
    this.archiveStore.setPlayer(this.player);
  }

  private loadContent(): void {
    EventTypes.registerAll();
    this.modLoader.load();
    Conditions.load();
    Screens.load();
    Keys.load();
    Achievements.load();
  }

  private async initMonitor(): Promise<void> {
    this.monitor = await KeyboardMonitor.create("keys.json", this.keysCenter);
  }

  private async initAchievementSystem() {
    this.achievementStore.bindPlayer(this.player);
    await this.achievementStore.load();
  }

  public async init() {
    // 提前唤醒控制台，不然后面的消息控制台不会刷新
    container.resolve(ConsoleStore);
    await this.configurationInitialization();
    this.loadPlayer();
    this.eventHistory.load();
    this.loadContent();

    registerBuiltinRegistrations();
    const levelManager = container.resolve(LevelManager);
    levelManager.setPlayer(this.player);

    this.modPluginLoader.setPlayer(this.player);
    this.modPluginLoader.loadEnabled();
    levelManager.loadAllLevels(); // 确保在加载所有事件的时候，确保条件已经加载完成，因此需要在模组加载完成之后进行

    await this.initMonitor();
    await this.initAchievementSystem();

    this.restoreLevelProgress();
    this.levelManager.initCompletedLevels(
      this.configStore.getSnapshot().completedLevels,
    );
    return this;
  }
}
