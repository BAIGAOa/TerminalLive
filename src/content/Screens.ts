import { container } from "../Container.js";
import { ScreenRegistry } from "../core/store/ScreenRegistry.js";
import { SettingRegistry } from "../core/store/SettingRegistry.js";
import { SCENES } from "../types/Scenes.js";
import { SETTING_MENU } from "../hooks/useSettingScreen.js";
import { PlayerDashboard } from "../ui/Game.js";
import Setting from "../ui/Setting.js";
import Language from "../ui/Language.js";
import AchievementScreen from "../ui/Achievement.js";
import Config from "../ui/Config.js";
import PlayerConfig from "../ui/PlayerConfig.js";
import ModManager from "../ui/ModManager.js";
import Archive from "../ui/Archive.js";

export class Screens {
  private static init = false;

  static load(): void {
    if (this.init) return;
    this.init = true;

    const screenReg = container.resolve(ScreenRegistry);

    screenReg.register({
      scene: SCENES.game,
      component: PlayerDashboard,
      nameKey: "main.startGame",
      highlightId: "start",
      props: (ctx) => ({ player: ctx.player }),
    });

    screenReg.register({
      scene: SCENES.config,
      component: Setting,
      nameKey: "main.enterConfig",
      highlightId: "config",
      props: (ctx) => ({
        onConfigChange: (m: any) => ctx.setMonitor(m),
        player: ctx.player,
      }),
    });

    screenReg.register({
      scene: SCENES.language,
      component: Language,
      nameKey: "main.configurationLanguage",
      highlightId: "language",
    });

    screenReg.register({
      scene: SCENES.achievement,
      component: AchievementScreen,
      nameKey: "main.achievement",
      highlightId: "achievement",
    });

    screenReg.register({
      scene: SCENES.archive,
      component: Archive,
      nameKey: "main.archive",
      highlightId: "archive",
    });

    const settingReg = container.resolve(SettingRegistry);

    settingReg.register({
      menu: SETTING_MENU.keyBoardConfig,
      component: Config,
      nameKey: "setting.keyBoardConfig",
    });

    settingReg.register({
      menu: SETTING_MENU.playerConfig,
      component: PlayerConfig,
      nameKey: "setting.playerConfig",
    });

    settingReg.register({
      menu: SETTING_MENU.modManager,
      component: ModManager,
      nameKey: "setting.modManager",
    });
  }
}
