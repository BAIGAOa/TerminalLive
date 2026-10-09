import { readFileSync } from "node:fs";
import { definePluginManifest } from "../../core/plugin/manifest.js";
import type { Plugin } from "../../core/plugin/types.js";
import type { ReplCandidate } from "../../core/repl/types.js";
import type EventCenter from "../../event/EventCenter.js";
import { formatDebugSummary } from "../../game/debugSummary.js";
import { validateEventFile } from "../../core/mod/eventValidation.js";

export const id = "core.console-commands";

export const manifest = definePluginManifest({
  id,
  nameKey: "plugin.core.consoleCommands.name",
  descKey: "plugin.core.consoleCommands.desc",
  capabilities: ["ui", "world", "kernel"],
});

/**
 * The developer console's toolkit: inspect the random stream, pin a seed to
 * replay a life, dump the draw journal, force an event, and read the live
 * simulation state.
 *
 * These used to be hard-wired into the kernel. They are a plugin now, which is
 * the point: a mod can replace `seed` or `force-event` with its own version and
 * the console will use it, because the command table resolves names and a
 * replacement displaces the built-in.
 */
export const plugin: Plugin = {
  id,
  hooks: {
    onInit(ctx) {
      const { random, director, worlds, config, events } = ctx.kernel;

      ctx.addCommand({
        name: "random-state",
        aliases: ["rng"],
        summary: "repl.cmd.randomState",
        usage: "random-state",
        run: (c) => {
          c.print(
            c.t("console.cmd.randomState", {
              seed: random.seed,
              step: random.step,
              fortune: Math.round(director.fortuneScore * 100) / 100,
            }),
          );
        },
      });

      ctx.addCommand({
        name: "random-log",
        aliases: ["replay"],
        summary: "repl.cmd.randomLog",
        usage: "random-log",
        run: (c) => {
          const records = random.journal.recent(12);
          if (records.length === 0) {
            c.print(c.t("console.cmd.randomLogEmpty"), "dim");
            return;
          }
          for (const r of records) {
            const chosen = r.candidates.find((cand) => cand.id === r.chosen);
            const pct = chosen ? Math.round(chosen.probability * 100) : 0;
            c.print(
              `#${r.seq} age=${r.age ?? "-"} [${r.label}] → ${
                r.chosen ?? "(none)"
              } ${pct}% of ${r.candidates.length}`,
            );
          }
        },
      });

      ctx.addCommand({
        name: "random-log-clear",
        aliases: ["replay-clear"],
        summary: "repl.cmd.randomLogClear",
        usage: "random-log-clear",
        run: (c) => {
          random.journal.clear();
          c.print(c.t("console.cmd.randomCleared"), "success");
        },
      });

      ctx.addCommand({
        name: "seed",
        summary: "repl.cmd.seed",
        usage: "seed <number>",
        run: (c) => {
          const raw = c.args[0];
          const value = Number(raw);
          if (!raw || !Number.isFinite(value)) {
            c.print(c.t("console.cmd.seedUsage"), "error");
            return;
          }
          random.reseed(value >>> 0);
          c.print(c.t("console.cmd.seedSet", { seed: random.seed }), "success");
        },
      });

      ctx.addCommand({
        name: "force-event",
        summary: "repl.cmd.forceEvent",
        usage: "force-event <id>",
        // Only the id argument has answers: the ids the active world loaded,
        // each carrying its event name for the console's help line.
        complete: (args) => (args.length > 0 ? [] : eventCandidates(events())),
        run: (c) => {
          const target = c.args[0];
          if (!target) {
            c.print(c.t("console.cmd.forceEventUsage"), "error");
            return;
          }
          if (!worlds.forceEvent(target)) {
            c.print(c.t("console.cmd.forceEventUnknown", { id: target }), "error");
            return;
          }
          c.print(c.t("console.cmd.forceEvent", { id: target }), "success");
        },
      });

      ctx.addCommand({
        name: "debug",
        aliases: ["state"],
        summary: "repl.cmd.debug",
        usage: "debug",
        run: (c) => {
          const player = worlds.getPlayer();
          const world = ctx.kernel.chronicle;
          const region = ctx.kernel.regions.getRegion(world.regionId);
          const lines = formatDebugSummary({
            player: player.playerName,
            age: Math.floor(player.age),
            year: world.year,
            era: world.eraId,
            region: region ? region.id : world.regionId,
            generation: ctx.kernel.lineage.getNextGeneration(),
            cash: player.money,
            netWorth: ctx.kernel.economy.netWorth(player.money),
            wellbeing: ctx.kernel.health.wellbeing(),
            expectancy: ctx.kernel.health.lifeExpectancy(player),
            tension: ctx.kernel.politics.getState().tension,
            order: ctx.kernel.politics.publicOrder(),
            marketBias:
              ctx.kernel.politics.marketBias() + ctx.kernel.chains.marketBias(),
            factions: Object.keys(ctx.kernel.politics.getState().factions).length,
            arcs: ctx.kernel.narrative.getArcs().length,
            chains: ctx.kernel.chains.activeChains(),
          });
          for (const line of lines) c.print(line);
        },
      });

      ctx.addCommand({
        name: "validate-event",
        summary: "repl.cmd.validateEvent",
        usage: "validate-event <file.json>",
        run: (c) => {
          const path = c.args[0];
          if (!path) {
            c.print(c.t("console.cmd.validateEventUsage"), "error");
            return;
          }
          try {
            const raw = JSON.parse(readFileSync(path, "utf-8"));
            const result = validateEventFile(raw);
            if (result.ok) {
              c.print(c.t("console.cmd.validateEventOk", { path }), "success");
              return;
            }
            c.print(
              c.t("console.cmd.validateEventErrors", {
                path,
                count: result.errors.length,
              }),
              "error",
            );
            for (const e of result.errors) c.print(`  ${e}`, "error");
          } catch (err) {
            c.print(
              c.t("console.cmd.validateEventReadFail", {
                path,
                error: (err as Error).message,
              }),
              "error",
            );
          }
        },
      });

      ctx.addCommand({
        name: "simplify",
        aliases: ["simple"],
        summary: "repl.cmd.simplify",
        usage: "simplify",
        run: (c) => {
          const on = !config.getSimplified();
          void config.setSimplified(on);
          c.print(c.t(on ? "repl.simplify.on" : "repl.simplify.off"), "success");
        },
      });

      ctx.addCommand({
        name: "venture",
        summary: "repl.cmd.venture",
        usage: "venture <industry> <capital>",
        run: (c) => {
          const industry = c.args[0];
          const capital = Number(c.args[1]);
          if (!industry || !Number.isFinite(capital)) {
            c.print(c.t("console.cmd.ventureUsage"), "error");
            return;
          }
          const player = worlds.getPlayer();
          const events = ctx.kernel.careers.investVenture(player, industry, capital);
          for (const ev of events) c.print(c.t(`career.ev.${ev.kind}`, ev.params));
        },
      });
    },
  },
};

/** Event ids of the active life, each carrying its name for the help line. */
function eventCandidates(center: EventCenter | null): ReplCandidate[] {
  if (!center) return [];
  return center
    .getAllIncidentIds()
    .sort()
    .map((eventId) => ({
      value: eventId,
      detailKey: center.getIncidentById(eventId)?.nameKey ?? undefined,
    }));
}
