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
import RandomService from "../core/random/RandomService.js";
import EventDirector from "../event/EventDirector.js";
import LevelManager from "../level/LevelManager.js";

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
    this.registerRandomCommands(cmdCenter);
  }

  /**
   * Random-subsystem debug tools: inspect the stream, pin a seed, dump the
   * draw journal, or force the next event — the "why did X (not) fire?" kit.
   */
  private static registerRandomCommands(cmdCenter: CommandCenter): void {
    const random = container.resolve(RandomService);
    const director = container.resolve(EventDirector);
    const levelManager = container.resolve(LevelManager);

    cmdCenter.register("random-state", (): CommandResult => {
      return {
        key: "console.cmd.randomState",
        params: {
          seed: random.seed,
          step: random.step,
          fortune: Math.round(director.fortuneScore * 100) / 100,
        },
      };
    });

    cmdCenter.register("seed", (args): CommandResult => {
      const seed = Number(args[0]);
      if (!args[0] || !Number.isFinite(seed)) {
        return { key: "console.cmd.seedUsage" };
      }
      random.reseed(seed >>> 0);
      return { key: "console.cmd.seedSet", params: { seed: random.seed } };
    });

    cmdCenter.register("random-log", (): string => {
      const records = random.journal.recent(12);
      if (records.length === 0) return "(random log empty)";
      return records
        .map((r) => {
          const chosen = r.candidates.find((c) => c.id === r.chosen);
          const pct = chosen ? Math.round(chosen.probability * 100) : 0;
          return `#${r.seq} age=${r.age ?? "-"} [${r.label}] → ${
            r.chosen ?? "(none)"
          } ${pct}% of ${r.candidates.length}`;
        })
        .join("\n");
    });

    cmdCenter.register("random-log-clear", (): CommandResult => {
      random.journal.clear();
      return { key: "console.cmd.randomCleared" };
    });

    cmdCenter.register("force-event", (args): CommandResult => {
      const id = args[0];
      if (!id) return { key: "console.cmd.forceEventUsage" };
      if (!levelManager.forceEvent(id)) {
        return { key: "console.cmd.forceEventUnknown", params: { id } };
      }
      return { key: "console.cmd.forceEvent", params: { id } };
    });
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
