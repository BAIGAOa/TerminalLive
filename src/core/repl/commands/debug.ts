import { readFileSync } from "node:fs";
import { container } from "../../../Container.js";
import ReplRegistry from "../ReplRegistry.js";
import RandomService from "../../random/RandomService.js";
import EventDirector from "../../../event/EventDirector.js";
import LevelManager from "../../../level/LevelManager.js";
import WorldState from "../../../world/chronicle/WorldState.js";
import PoliticsSystem from "../../../world/politics/PoliticsSystem.js";
import EconomySystem from "../../../world/economy/EconomySystem.js";
import HealthSystem from "../../../world/health/HealthSystem.js";
import NarrativeSystem from "../../../world/narrative/NarrativeSystem.js";
import WorldChainSystem from "../../../world/chains/WorldChainSystem.js";
import RegionsSystem from "../../../world/regions/RegionsSystem.js";
import LineageStore from "../../../core/store/LineageStore.js";
import { formatDebugSummary } from "../../../game/debugSummary.js";
import { validateEventFile } from "../../mod/eventValidation.js";
import ConfigStore from "../../../core/store/ConfigStore.js";
import CareerSystem from "../../../world/careers/CareerSystem.js";

/**
 * Random-subsystem debug tools — the "why did X (not) fire?" kit. Inspect the
 * stream, pin a seed to replay a life, dump the draw journal, or force the next
 * event. Reached from the developer console (`P`).
 */
export function registerDebugCommands(reg: ReplRegistry): void {
  reg.register({
    name: "random-state",
    aliases: ["rng"],
    summary: "repl.cmd.randomState",
    usage: "random-state",
    run: (ctx) => {
      const random = container.resolve(RandomService);
      const director = container.resolve(EventDirector);
      ctx.print(
        ctx.t("console.cmd.randomState", {
          seed: random.seed,
          step: random.step,
          fortune: Math.round(director.fortuneScore * 100) / 100,
        }),
      );
    },
  });

  reg.register({
    name: "seed",
    summary: "repl.cmd.seed",
    usage: "seed <number>",
    run: (ctx) => {
      const raw = ctx.args[0];
      const seed = Number(raw);
      if (!raw || !Number.isFinite(seed)) {
        ctx.print(ctx.t("console.cmd.seedUsage"), "error");
        return;
      }
      const random = container.resolve(RandomService);
      random.reseed(seed >>> 0);
      ctx.print(ctx.t("console.cmd.seedSet", { seed: random.seed }), "success");
    },
  });

  reg.register({
    name: "random-log",
    aliases: ["replay"],
    summary: "repl.cmd.randomLog",
    usage: "random-log",
    run: (ctx) => {
      const records = container.resolve(RandomService).journal.recent(12);
      if (records.length === 0) {
        ctx.print("(random log empty)", "dim");
        return;
      }
      for (const r of records) {
        const chosen = r.candidates.find((c) => c.id === r.chosen);
        const pct = chosen ? Math.round(chosen.probability * 100) : 0;
        ctx.print(
          `#${r.seq} age=${r.age ?? "-"} [${r.label}] → ${
            r.chosen ?? "(none)"
          } ${pct}% of ${r.candidates.length}`,
        );
      }
    },
  });

  reg.register({
    name: "random-log-clear",
    aliases: ["replay-clear"],
    summary: "repl.cmd.randomLogClear",
    usage: "random-log-clear",
    run: (ctx) => {
      container.resolve(RandomService).journal.clear();
      ctx.print(ctx.t("console.cmd.randomCleared"), "success");
    },
  });

  reg.register({
    name: "force-event",
    summary: "repl.cmd.forceEvent",
    usage: "force-event <id>",
    run: (ctx) => {
      const id = ctx.args[0];
      if (!id) {
        ctx.print(ctx.t("console.cmd.forceEventUsage"), "error");
        return;
      }
      if (!container.resolve(LevelManager).forceEvent(id)) {
        ctx.print(ctx.t("console.cmd.forceEventUnknown", { id }), "error");
        return;
      }
      ctx.print(ctx.t("console.cmd.forceEvent", { id }), "success");
    },
  });

  reg.register({
    name: "debug",
    aliases: ["state"],
    summary: "repl.cmd.debug",
    usage: "debug",
    run: (ctx) => {
      const lm = container.resolve(LevelManager);
      const player = lm.getPlayer();
      const world = container.resolve(WorldState);
      const politics = container.resolve(PoliticsSystem);
      const economy = container.resolve(EconomySystem);
      const health = container.resolve(HealthSystem);
      const narrative = container.resolve(NarrativeSystem);
      const chains = container.resolve(WorldChainSystem);
      const regions = container.resolve(RegionsSystem);
      const region = regions.getRegion(world.regionId);
      const lines = formatDebugSummary({
        player: player.playerName,
        age: Math.floor(player.age),
        year: world.year,
        era: world.eraId,
        region: region ? region.id : world.regionId,
        generation: container.resolve(LineageStore).getNextGeneration(),
        cash: player.money,
        netWorth: economy.netWorth(player.money),
        wellbeing: health.wellbeing(),
        expectancy: health.lifeExpectancy(player),
        tension: politics.getState().tension,
        order: politics.publicOrder(),
        marketBias: politics.marketBias() + chains.marketBias(),
        factions: Object.keys(politics.getState().factions).length,
        arcs: narrative.getArcs().length,
        chains: chains.activeChains(),
      });
      for (const line of lines) ctx.print(line);
    },
  });

  reg.register({
    name: "validate-event",
    summary: "repl.cmd.validateEvent",
    usage: "validate-event <file.json>",
    run: (ctx) => {
      const path = ctx.args[0];
      if (!path) {
        ctx.print("usage: validate-event <file.json>", "error");
        return;
      }
      try {
        const raw = JSON.parse(readFileSync(path, "utf-8"));
        const result = validateEventFile(raw);
        if (result.ok) {
          ctx.print(`${path}: OK`, "success");
        } else {
          ctx.print(`${path}: ${result.errors.length} problem(s)`, "error");
          for (const e of result.errors) ctx.print(`  ${e}`, "error");
        }
      } catch (err) {
        ctx.print(`cannot read ${path}: ${(err as Error).message}`, "error");
      }
    },
  });

  reg.register({
    name: "simplify",
    aliases: ["simple"],
    summary: "repl.cmd.simplify",
    usage: "simplify",
    run: (ctx) => {
      const store = container.resolve(ConfigStore);
      const on = !store.getSimplified();
      void store.setSimplified(on);
      ctx.print(ctx.t(on ? "repl.simplify.on" : "repl.simplify.off"), "success");
    },
  });

  reg.register({
    name: "venture",
    summary: "repl.cmd.venture",
    usage: "venture <industry> <capital>",
    run: (ctx) => {
      const industry = ctx.args[0];
      const capital = Number(ctx.args[1]);
      if (!industry || !Number.isFinite(capital)) {
        ctx.print("usage: venture <industry> <capital>", "error");
        return;
      }
      const player = container.resolve(LevelManager).getPlayer();
      const events = container
        .resolve(CareerSystem)
        .investVenture(player, industry, capital);
      for (const ev of events) ctx.print(ctx.t(`career.ev.${ev.kind}`, ev.params));
    },
  });
}
