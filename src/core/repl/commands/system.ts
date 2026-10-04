import { back, gotoScreen } from "ink-cartridge";
import { container } from "../../../Container.js";
import ReplRegistry from "../ReplRegistry.js";
import ThemeCenter from "../../theme/ThemeCenter.js";
import ThemeManager from "../../theme/ThemeManager.js";
import ModMonitor from "../../mod/ModMonitor.js";
import ModPluginLoader from "../../mod/ModPluginLoader.js";
import { VersionProvider } from "../../version/VersionProvider.js";
import ModManager from "../../../ui/ModManager.js";
import ThemeScreen from "../../../ui/ThemeScreen.js";

/** Meta commands: help, clear, theme, mods, back, version, exit. */
export function registerSystemCommands(reg: ReplRegistry): void {
  reg.register({
    name: "help",
    aliases: ["?", "man"],
    summary: "repl.cmd.help",
    usage: "help [command]",
    complete: () => reg.visible().map((c) => c.name),
    run: (ctx) => {
      const target = ctx.args[0]?.toLowerCase();
      if (target) {
        const cmd = reg.resolve(target);
        if (!cmd) {
          ctx.print(ctx.t("repl.err.unknown", { name: target }), "error");
          return;
        }
        ctx.print(`  ${cmd.usage ?? cmd.name}`, "success");
        ctx.print(`  ${ctx.t(cmd.summary)}`, "dim");
        for (const sub of cmd.subcommands ?? []) {
          ctx.print(`    ${sub.name}  ${ctx.t(sub.summary)}`);
        }
        return;
      }
      ctx.print(ctx.t("repl.help.title"), "info");
      for (const cmd of reg.visible()) {
        const name = cmd.usage ?? cmd.name;
        ctx.print(`  ${name.padEnd(18)} ${ctx.t(cmd.summary)}`);
      }
      ctx.print(ctx.t("repl.help.hint"), "dim");
    },
  });

  reg.register({
    name: "clear",
    aliases: ["cls"],
    summary: "repl.cmd.clear",
    usage: "clear",
    run: (ctx) => ctx.clear(),
  });

  reg.register({
    name: "theme",
    aliases: ["skin"],
    summary: "repl.cmd.theme",
    usage: "theme [id]",
    complete: () => container.resolve(ThemeCenter).getAllTheme().map((t) => t.id),
    run: (ctx) => {
      const id = ctx.args[0];
      if (!id) {
        ctx.print(ctx.t("repl.enter.theme"), "dim");
        ctx.close?.();
        gotoScreen(ThemeScreen, {});
        return;
      }
      try {
        container.resolve(ThemeManager).setCurrent(id);
        ctx.print(ctx.t("console.cmd.setTheme", { id }), "success");
      } catch {
        ctx.print(ctx.t("repl.theme.unknown", { id }), "error");
      }
    },
  });

  reg.register({
    name: "mods",
    aliases: ["mod"],
    summary: "repl.cmd.mods",
    usage: "mods [list|reload]",
    subcommands: [
      {
        name: "list",
        summary: "repl.sub.mods.list",
        run: (ctx) => {
          const all = container.resolve(ModMonitor).getAllMods();
          if (all.length === 0) {
            ctx.print(ctx.t("repl.mods.none"), "dim");
            return;
          }
          for (const name of all) ctx.print(`  ${name}`);
        },
      },
      {
        name: "reload",
        summary: "repl.sub.mods.reload",
        run: (ctx) => {
          const count = container
            .resolve(ModPluginLoader)
            .getLoadedMods().length;
          container.resolve(ModPluginLoader).reloadEnabled();
          ctx.print(ctx.t("console.cmd.modsReload", { count }), "success");
        },
      },
    ],
    run: (ctx) => {
      ctx.print(ctx.t("repl.enter.mods"), "dim");
      ctx.close?.();
      gotoScreen(ModManager, {});
    },
  });

  reg.register({
    name: "back",
    summary: "repl.cmd.back",
    usage: "back",
    run: () => back(),
  });

  reg.register({
    name: "version",
    aliases: ["ver", "about"],
    summary: "repl.cmd.version",
    usage: "version",
    run: (ctx) => {
      const v = container.resolve(VersionProvider).version;
      ctx.print(ctx.t("repl.version", { version: v }), "info");
    },
  });

  reg.register({
    name: "exit",
    aliases: ["quit", "q"],
    summary: "repl.cmd.exit",
    usage: "exit",
    run: (ctx) => {
      ctx.print(ctx.t("repl.exit"), "dim");
      process.exit(0);
    },
  });
}
