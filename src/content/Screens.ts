import { container } from "../Container.js";
import LevelGame from "../ui/LevelGame.js";
import Setting from "../ui/Setting.js";
import Language from "../ui/Language.js";
import AchievementScreen from "../ui/Achievement.js";
import Config from "../ui/Config.js";
import PlayerConfig from "../ui/PlayerConfig.js";
import ModManager from "../ui/ModManager.js";
import Archive from "../ui/Archive.js";
import LevelSelection from "../ui/LevelSelection.js";
import ThemeScreen from "../ui/ThemeScreen.js";
import { ScreenRegistry } from "../core/registry/ScreenRegistry.js";
import { SettingRegistry } from "../core/registry/SettingRegistry.js";

export class Screens {
  private static init = false;

  static load(): void {
    if (this.init) return;
    this.init = true;

    const screenReg = container.resolve(ScreenRegistry);

    screenReg.register("game", {
      component: LevelGame,
      nameKey: "main.startGame",
      highlightId: "start",
      hide: true,
      props: (ctx) => ({ player: ctx.player }),
    });

    screenReg.register("levelSelection", {
      component: LevelSelection,
      nameKey: "main.levelSelection",
      highlightId: "levelSelection",
    });

    screenReg.register("config", {
      component: Setting,
      nameKey: "main.enterConfig",
      highlightId: "config",
      props: (ctx) => ({
        onConfigChange: (m: any) => ctx.setMonitor(m),
        player: ctx.player,
      }),
    });

    screenReg.register("language", {
      component: Language,
      nameKey: "main.configurationLanguage",
      highlightId: "language",
    });

    screenReg.register("achievement", {
      component: AchievementScreen,
      nameKey: "main.achievement",
      highlightId: "achievement",
    });

    screenReg.register("archive", {
      component: Archive,
      nameKey: "main.archive",
      highlightId: "archive",
    });

    const settingReg = container.resolve(SettingRegistry);

    settingReg.register("keyBoardConfig", {
      component: Config,
      nameKey: "setting.keyBoardConfig",
    });

    settingReg.register("playerConfig", {
      component: PlayerConfig,
      nameKey: "setting.playerConfig",
    });

    settingReg.register("modManager", {
      component: ModManager,
      nameKey: "setting.modManager",
    });

    settingReg.register("theme", {
      component: ThemeScreen,
      nameKey: "setting.theme",
    });
  }
}
