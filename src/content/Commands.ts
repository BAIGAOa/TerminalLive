import { container } from "../Container.js";
import ConsoleStore from "../core/console/ConsoleStore.js";
import CommandCenter from "../core/registry/CommandCenter.js";
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

    cmdCenter.register("help", () => {
      const commands = cmdCenter.getAll();
      const list = Array.from(commands.keys()).join(", ");
      return {
        key: "console.cmd.help",
        params: { list },
      };
    });

    cmdCenter.register("clear", () => {
      consoleStore.clearCommandResults();
      return {
        key: "console.cmd.clear",
      };
    });

    for (const each of themeCenter.getAllTheme()) {
      cmdCenter.register(`theme-${each.id}`, () => {
        themeManager.setCurrent(each.id);
        return {
          key: "console.cmd.setTheme",
          params: { id: each.id },
        };
      });
    }

    cmdCenter.register("themes", () => {
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
