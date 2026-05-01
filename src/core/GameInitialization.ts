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

  public modPluginLoader: ModPluginLoader;

  constructor() {
    this.configStore = inject(ConfigStore);
    this.game = inject(Game);
    this.keysCenter = inject(KeysCenter);
    this.achievementStore = inject(AchievementStore);
    this.modLoader = inject(ModLoader);
    this.modRegistry = inject(ModRegistry);
    this.modPluginLoader = inject(ModPluginLoader);
  }

  private loadModPlugins(): void {
    this.modPluginLoader.setPlayer(this.player);
    this.modPluginLoader.loadEnabled();
    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (this.modRegistry.isValid(modName)) {
        this.modLoader.loadFromDir(this.modRegistry.getModEventsPath(modName));
      }
    }
  }

  //初始化配置，用于从本地获取配置并加载
  private async configurationInitialization() {
    await this.configStore.init();
  }

  //加载创建玩家全局实例
  private loadPlayer(): void {
    this.player = new Player(this.configStore.getPlayerConfig());
  }

  private loadContent(): void {
    EventTypes.registerAll();
    this.modLoader.load();
    Screens.load();
    Keys.load();
    Achievements.load();
  }

  private initGame(): void {
    this.game.init(this.player);
  }

  private async initMonitor(): Promise<void> {
    this.monitor = await KeyboardMonitor.create("keys.json", this.keysCenter);
  }

  private async initAchievementSystem() {
    this.achievementStore.bindPlayer(this.player);
    await this.achievementStore.load();
  }

  public async init() {
    //提前让控制台激活
    // 如果不这样做，那么模组加载信息就不会出现在控制台，包括其他信息
    container.resolve(ConsoleStore);
    await this.configurationInitialization();
    this.loadPlayer();
    this.loadContent();
    this.loadModPlugins();
    this.initGame();
    await this.initMonitor();
    await this.initAchievementSystem();
    return this;
  }
}
