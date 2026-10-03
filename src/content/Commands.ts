import { container } from "../Container.js";
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ConsoleStore from "../core/console/ConsoleStore.js";
import CommandCenter, { CommandResult } from "../core/registry/CommandCenter.js";
import ThemeCenter from "../core/theme/ThemeCenter.js";
import ThemeManager from "../core/theme/ThemeManager.js";
import ModMonitor from "../core/mod/ModMonitor.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";
import ModWatcher from "../core/mod/ModWatcher.js";
import ConfigStore from "../core/store/ConfigStore.js";

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

    this.registerModCommands(cmdCenter);
  }

  private static registerModCommands(cmdCenter: CommandCenter): void {
    const registry = container.resolve(ModMonitor);
    const loader = container.resolve(ModPluginLoader);
    const watcher = container.resolve(ModWatcher);
    const configStore = container.resolve(ConfigStore);

    cmdCenter.register("mods", () => {
      const built = registry
        .getAllResolved()
        .map((m) => (configStore.getEnabledMods().includes(m.dirName) ? "*" : " "))
        .join("");
      const list = loader
        .getLoadedMods()
        .map((m) => m.id)
        .join(", ");
      return {
        key: "console.cmd.mods",
        params: { list: list || "-", built: built || "-" },
      };
    });

    cmdCenter.register("mods-list", () => {
      const list = registry.getAllMods().join(", ");
      return {
        key: "console.cmd.modsList",
        params: { list: list || "-" },
      };
    });

    cmdCenter.register("mods-reload", () => {
      const count = watcher.reloadNow();
      return {
        key: "console.cmd.modsReload",
        params: { count },
      };
    });

    cmdCenter.register("mods-watch", () => {
      if (watcher.active) {
        watcher.stop();
        return { key: "console.cmd.modsWatchOff" };
      }
      const ok = watcher.start();
      return { key: ok ? "console.cmd.modsWatchOn" : "console.cmd.modsWatchFail" };
    });

    cmdCenter.register("mods-example", (): CommandResult => {
      const src = join(
        dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "resource",
        "example-mod",
      );
      if (!existsSync(src)) return { key: "console.cmd.modsExampleMissing" };
      const dest = join(registry.MOD_ROOT, "example_mod");
      try {
        cpSync(src, dest, { recursive: true });
      } catch (err) {
        return {
          key: "console.cmd.modsExampleFail",
          params: { error: (err as Error).message },
        };
      }
      return { key: "console.cmd.modsExampleOk", params: { dest } };
    });
  }
}
