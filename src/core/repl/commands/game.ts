import { gotoScreen } from "ink-cartridge";
import { container } from "../../../Container.js";
import ReplRegistry from "../ReplRegistry.js";
import { ReplContext } from "../types.js";
import WorldManager from "../../../worlds/WorldManager.js";
import DifficultyRegistry from "../../registry/DifficultyRegistry.js";
import { sortWorldsLinearly } from "../../../worlds/worldChain.js";
import CareerSystem from "../../../world/careers/CareerSystem.js";
import WorldGame from "../../../ui/WorldGame.js";
import ConfigStore from "../../store/ConfigStore.js";
import BuiltinPluginRegistry from "../../mod/BuiltinPlugin.js";

function startAndEnter(ctx: ReplContext, levelId: string): boolean {
  const lm = container.resolve(WorldManager);
  const level = lm.getLevel(levelId);
  if (!level) {
    ctx.print(ctx.t("repl.play.unknownLevel", { id: levelId }), "error");
    return false;
  }
  ctx.print(ctx.t("repl.play.started", { level: ctx.t(level.nameKey) }), "success");
  lm.start(levelId);
  ctx.close?.();
  gotoScreen(WorldGame, {});
  return true;
}

/** Commands to start / list / resume a life. */
export function registerGameCommands(reg: ReplRegistry): void {
  reg.register({
    name: "play",
    aliases: ["new", "start"],
    summary: "repl.cmd.play",
    usage: "play [levelId]",
    complete: () =>
      [...container.resolve(WorldManager).getAllWorlds().keys()],
    run: (ctx) => {
      const lm = container.resolve(WorldManager);
      const id = ctx.args[0] ?? lm.getRootWorldIds()[0];
      if (!id) {
        ctx.print(ctx.t("repl.play.noLevels"), "error");
        return;
      }
      startAndEnter(ctx, id);
    },
  });

  reg.register({
    name: "continue",
    aliases: ["resume"],
    summary: "repl.cmd.continue",
    usage: "continue",
    run: (ctx) => {
      const lm = container.resolve(WorldManager);
      if (!lm.hasActiveWorld()) {
        ctx.print(ctx.t("repl.continue.none"), "error");
        return;
      }
      ctx.print(ctx.t("repl.enter.game"), "dim");
      ctx.close?.();
      gotoScreen(WorldGame, {});
    },
  });

  reg.register({
    name: "levels",
    aliases: ["level"],
    summary: "repl.cmd.levels",
    usage: "levels [difficulty]",
    complete: () => container.resolve(DifficultyRegistry).getDifficulties(),
    run: (ctx) => {
      const lm = container.resolve(WorldManager);
      const diff = container.resolve(DifficultyRegistry);
      const difficulties = ctx.args[0] ? [ctx.args[0]] : diff.getDifficulties();
      for (const d of difficulties) {
        const ordered = sortWorldsLinearly(diff.getLevels(d));
        if (ordered.length === 0) continue;
        ctx.print(`${d}:`, "dim");
        for (const level of ordered) {
          const done = lm.isWorldCompleted(level.id);
          const mark = done ? "✓" : "·";
          ctx.print(`  ${mark} ${level.id}  ${ctx.t(level.nameKey)}`);
        }
      }
    },
  });

  reg.register({
    name: "career",
    aliases: ["job"],
    summary: "repl.cmd.career",
    usage: "career",
    run: (ctx) => {
      const lm = container.resolve(WorldManager);
      if (!lm.hasActiveWorld()) {
        ctx.print(ctx.t("repl.career.none"), "error");
        return;
      }
      const state = container.resolve(CareerSystem).getState(lm.getPlayer());
      if (!state) {
        ctx.print(ctx.t("career.none"), "dim");
        return;
      }
      ctx.print(
        `${ctx.t(state.career.labelKey)} · ${ctx.t(state.rankDef.titleKey)}  $${state.salary}${ctx.t("career.perYear")}`,
        "success",
      );
      if (state.next) {
        ctx.print(
          `${ctx.t("career.next", { title: ctx.t(state.next.rankDef.titleKey) })} ${
            state.next.met ? "✓" : "…"
          }`,
          "dim",
        );
      } else {
        ctx.print(ctx.t("career.max"), "dim");
      }
    },
  });

  reg.register({
    name: "builtins",
    aliases: ["plugins"],
    summary: "repl.cmd.builtins",
    usage: "builtins [id]",
    complete: () => container.resolve(BuiltinPluginRegistry).available(),
    run: (ctx) => {
      const bp = container.resolve(BuiltinPluginRegistry);
      const cfg = container.resolve(ConfigStore);
      const all = bp.available();
      const id = ctx.args[0];
      if (id) {
        if (!all.includes(id)) {
          ctx.print(`未知内置插件 / unknown built-in plugin: ${id}`, "error");
          return;
        }
        const enabled = cfg.getEnabledBuiltinPlugins() ?? all;
        const next = enabled.includes(id)
          ? enabled.filter((x) => x !== id)
          : [...enabled, id];
        void cfg.setEnabledBuiltinPlugins(next);
        ctx.print(`${id}: ${next.includes(id) ? "ON" : "OFF"}  (下一次进入世界生效)`, "success");
        return;
      }
      const enabled = cfg.getEnabledBuiltinPlugins();
      for (const pid of all) {
        const on = enabled === null ? true : enabled.includes(pid);
        ctx.print(`${on ? "●" : "○"} ${pid}`, on ? "success" : "dim");
      }
      ctx.print(ctx.t("repl.cmd.builtins.hint") || "builtins <id> to toggle", "dim");
    },
  });
}
