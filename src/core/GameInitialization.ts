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

  constructor() {
    this.configStore = inject(ConfigStore);
    this.game = inject(Game);
    this.keysCenter = inject(KeysCenter);
    this.achievementStore = inject(AchievementStore);
    this.modLoader = inject(ModLoader);
    this.modRegistry = inject(ModRegistry);
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
    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (this.modRegistry.isValid(modName)) {
        this.modLoader.loadFromDir(this.modRegistry.getModEventsPath(modName));
      } else {
        console.warn(`Mod "${modName}" 结构无效，跳过`);
      }
    }
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
    await this.configurationInitialization();
    this.loadPlayer();
    this.loadContent();
    this.initGame();
    await this.initMonitor();
    await this.initAchievementSystem();
    return this;
  }
}
