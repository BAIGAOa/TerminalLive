import { container } from "../Container.js";
import CommandCenter from "../core/console/CommandCenter.js";
import ConsoleStore from "../core/console/ConsoleStore.js";

export default class Commands {
  private static init: boolean = false;

  public static load(): void {
    if (this.init) return;
    this.init = true;

    const cmdCenter = container.resolve(CommandCenter);
    const consoleStore = container.resolve(ConsoleStore);

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
  }
}