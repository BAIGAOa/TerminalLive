import { container } from "../Container.js";
import CommandCenter from "../core/console/CommandCenter.js";
import ConsoleStore from "../core/console/ConsoleStore.js";
import ThemeCenter from "../core/theme/ThemeCenter.js";
import ThemeManager from "../core/theme/ThemeManager.js";

export default class Commands {
  private static init: boolean = false;

  public static load(): void {
    if (this.init) return;
    this.init = true;

    const cmdCenter = container.resolve(CommandCenter);
    const consoleStore = container.resolve(ConsoleStore);
    const themeCenter = container.resolve(ThemeCenter);
    const themeManager = container.resolve(ThemeManager);

    cmdCenter.addCommand("help", () => {
      const commands = cmdCenter.getAllCommands();
      const list = Array.from(commands.keys()).join(", ");
      return {
        key: "console.cmd.help",
        params: { list },
      };
    });

    cmdCenter.addCommand("clear", () => {
      consoleStore.clearCommandResults();
      return {
        key: "console.cmd.clear",
      };
    });

    for (const each of themeCenter.getAllTheme()) {
      cmdCenter.addCommand(`theme-${each.id}`, () => {
        themeManager.setCurrent(each.id);
        return {
          key: "console.cmd.setTheme",
          params: { id: each.id },
        };
      });
    }

    cmdCenter.addCommand("themes", () => {
      const list = themeCenter
        .getAllTheme()
        .map((t) => t.id)
        .join(", ");
      return {
        key: "console.cmd.themes",
        params: {
          list,
          current: themeManager.getCurrentId() ?? "none",
        },
      };
    });
  }
}
