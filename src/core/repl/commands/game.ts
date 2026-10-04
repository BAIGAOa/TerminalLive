import { gotoScreen } from "ink-cartridge";
import { container } from "../../../Container.js";
import ReplRegistry from "../ReplRegistry.js";
import { ReplContext } from "../types.js";
import LevelManager from "../../../level/LevelManager.js";
import DifficultyRegistry from "../../registry/DifficultyRegistry.js";
import { sortLevelsLinearly } from "../../../level/levelChain.js";
import CareerSystem from "../../../world/careers/CareerSystem.js";
import LevelGame from "../../../ui/LevelGame.js";

function startAndEnter(ctx: ReplContext, levelId: string): boolean {
  const lm = container.resolve(LevelManager);
  const level = lm.getLevel(levelId);
  if (!level) {
    ctx.print(ctx.t("repl.play.unknownLevel", { id: levelId }), "error");
    return false;
  }
  ctx.print(ctx.t("repl.play.started", { level: ctx.t(level.nameKey) }), "success");
  lm.start(levelId);
  ctx.close?.();
  gotoScreen(LevelGame, {});
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
      [...container.resolve(LevelManager).getAllLevels().keys()],
    run: (ctx) => {
      const lm = container.resolve(LevelManager);
      const id = ctx.args[0] ?? lm.getRootLevelIds()[0];
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
      const lm = container.resolve(LevelManager);
      if (!lm.hasActiveLevel()) {
        ctx.print(ctx.t("repl.continue.none"), "error");
        return;
      }
      ctx.print(ctx.t("repl.enter.game"), "dim");
      ctx.close?.();
      gotoScreen(LevelGame, {});
    },
  });

  reg.register({
    name: "levels",
    aliases: ["level"],
    summary: "repl.cmd.levels",
    usage: "levels [difficulty]",
    complete: () => container.resolve(DifficultyRegistry).getDifficulties(),
    run: (ctx) => {
      const lm = container.resolve(LevelManager);
      const diff = container.resolve(DifficultyRegistry);
      const difficulties = ctx.args[0] ? [ctx.args[0]] : diff.getDifficulties();
      for (const d of difficulties) {
        const ordered = sortLevelsLinearly(diff.getLevels(d));
        if (ordered.length === 0) continue;
        ctx.print(`${d}:`, "dim");
        for (const level of ordered) {
          const done = lm.isLevelCompleted(level.id);
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
      const lm = container.resolve(LevelManager);
      if (!lm.hasActiveLevel()) {
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
}
