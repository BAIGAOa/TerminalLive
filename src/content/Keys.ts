import { container } from "../Container.js";
import ConsoleStore from "../core/console/ConsoleStore.js";
import Game from "../core/Game.js";
import Key from "../core/keys/Key.js";
import HighlightStore from "../core/store/HighlightStore.js";
import ScreenStore from "../core/store/ScreenStore.js";

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
  public static enterArchive: Key;

  public static load(): void {
    if (!this.init) {
      this.init = true;

      const highLight = container.resolve(HighlightStore);
      const screen = container.resolve(ScreenStore);

      this.exitGame = new Key("exit-game", () => {
        highLight.setActive("exit");
        setTimeout(() => process.exit(0), 200);
      });

      this.startGame = new Key("start-game", () => {
        highLight.setActive("start");
        setTimeout(() => screen.setScene("levelSelection"));
      });

      this.returnToMainInterface = new Key("return-to-mainInterface", () => {
        highLight.setActive("start");
        screen.setScene("menu");
      });

      this.nextRound = new Key("next-round", () => {
        container.resolve(Game).update();
      });

      this.enterConfig = new Key("enter-config", () => {
        highLight.setActive("config");
        setTimeout(() => screen.setScene("config"), 200);
      });

      this.languageEnter = new Key("enter-language", () => {
        highLight.setActive("language");
        setTimeout(() => screen.setScene("language"), 200);
      });

      this.enterAchievement = new Key("enter-achievement", () => {
        highLight.setActive("achievement");
        setTimeout(() => screen.setScene("achievement"), 200);
      });

      this.toggleConsole = new Key("toggle-console", () => {
        container.resolve(ConsoleStore).toggle();
      });

      this.enterArchive = new Key("enter-archive", () => {
        highLight.setActive("archive");
        setTimeout(() => screen.setScene("archive"), 200);
      });
    }
  }
}
