import { container } from "../Container.js";
import ConsoleStore from "../core/console/ConsoleStore.js";
import Game from "../core/Game.js";
import Key from "../core/keys/Key.js";
import GameViewStore from "../core/store/GameViewStore.js";
import HighlightStore from "../core/store/HighlightStore.js";
import ScreenStore from "../core/store/ScreenStore.js";
import { GameViveModes } from "../types/GameViveModeType.js";
import { SCENES } from "../types/Scenes.js";

export default class Keys {
  private static init: boolean = false;

  public static exitGame: Key;
  public static startGame: Key;
  public static returnToMainInterface: Key;
  public static enterConfig: Key;
  public static nextRound: Key;
  public static languageEnter: Key;
  public static enterAchievement: Key;
  public static toggleConsole: Key;
  public static showAttributes: Key;
  public static showStatus: Key;

  public static load(): void {
    if (!this.init) {
      this.init = true;

      const highLight = container.resolve(HighlightStore);
      const screen = container.resolve(ScreenStore);
      const viveGame = container.resolve(GameViewStore);

      this.exitGame = new Key("exit-game", () => {
        highLight.setActive("exit");
        setTimeout(() => process.exit(0), 200);
      });

      this.startGame = new Key("start-game", () => {
        highLight.setActive("start");
        setTimeout(() => screen.setScene(SCENES.game));
      });

      this.returnToMainInterface = new Key("return-to-mainInterface", () => {
        highLight.setActive("start");
        screen.setScene(SCENES.menu);
      });

      this.nextRound = new Key("next-round", () => {
        container.resolve(Game).update();
      });

      this.enterConfig = new Key("enter-config", () => {
        highLight.setActive("config");
        setTimeout(() => screen.setScene(SCENES.config), 200);
      });

      this.languageEnter = new Key("enter-language", () => {
        highLight.setActive("language");
        setTimeout(() => screen.setScene(SCENES.language), 200);
      });

      this.enterAchievement = new Key("enter-achievement", () => {
        highLight.setActive("achievement");
        setTimeout(() => screen.setScene(SCENES.achievement), 200);
      });

      this.toggleConsole = new Key("toggle-console", () => {
        container.resolve(ConsoleStore).toggle();
      });

      this.showAttributes = new Key("show-attributes", () => {
        viveGame.setView(GameViveModes.attributes);
      });

      this.showStatus = new Key("show-status", () => {
        viveGame.setView(GameViveModes.status);
      });
    }
  }
}
