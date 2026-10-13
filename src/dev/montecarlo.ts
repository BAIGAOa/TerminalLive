/**
 * Monte-Carlo balance harness. Plays many full lives from known seeds and
 * reports event frequencies, lifespan and attribute distributions — so weights
 * can be tuned against statistics instead of vibes.
 *
 * Run with: npm run balance        (builds, then runs N lives)
 *           npm run balance -- 500 (override the life count)
 *
 * Every life is seeded deterministically (`BASE_SEED + i`), so a flagged run
 * reproduces exactly: replay a single life with the in-game `seed <n>` command.
 */
import { container } from "../Container.js";
import GameInitialization from "../core/GameInitialization.js";
import WorldManager from "../worlds/WorldManager.js";
import Game from "../core/Game.js";
import HealthSystem from "../world/health/HealthSystem.js";
import CareerSystem from "../world/careers/CareerSystem.js";
import VitalsSystem from "../world/VitalsSystem.js";
import ConfigStore from "../core/store/ConfigStore.js";
import TypedEventBus from "../core/TypedEventBus.js";
import RandomService from "../core/random/RandomService.js";
import AchievementRegistry from "../core/registry/AchievementRegistry.js";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resourcePath } from "../core/paths.js";

const AUTOSAVE_TMP = `${tmpdir()}/tl-mc-${process.pid}.json`;
process.env.TL_AUTOSAVE = AUTOSAVE_TMP;

const BASE_SEED = 0x5ee6;
const LIVES = Math.max(1, Number(process.argv[2]) || 200);

// Deterministic Math.random too, so any stray call can't break replayability.
let mcSeed = 0x1234abcd;
Math.random = () => {
  mcSeed = (mcSeed + 0x6d2b79f5) | 0;
  let t = Math.imul(mcSeed ^ (mcSeed >>> 15), 1 | mcSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PERSISTED = ["config.json", "achievement/unlocked.json", "history.json"];
const backups = new Map<string, string>();
function backup(): void {
  for (const rel of PERSISTED) {
    try {
      backups.set(rel, readFileSync(resourcePath(rel), "utf8"));
    } catch {
      /* may not exist */
    }
  }
}
function restore(): void {
  for (const [rel, content] of backups) {
    try {
      writeFileSync(resourcePath(rel), content, "utf8");
    } catch {
      /* ignore */
    }
  }
  try {
    rmSync(AUTOSAVE_TMP, { force: true });
  } catch {
    /* ignore */
  }
}
process.on("exit", restore);

function pct(n: number, total: number): string {
  return `${((n / Math.max(1, total)) * 100).toFixed(1)}%`;
}

/** Middle value of an already-sorted list (0 when empty). */
function medianOf(sorted: number[]): number {
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Value at a quantile of an already-sorted list. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
}

async function main() {
  backup();
  await container.resolve(GameInitialization).init();
  // Force the harness offline. A configured API key would otherwise make every
  // run depend on the network — and cost a 30s timeout per attempt — so the
  // numbers below would stop being a function of the seed alone.
  const config = container.resolve(ConfigStore);
  await config.setDeepseekApiKey("");
  await config.setMailFrequency("off");

  const lm = container.resolve(WorldManager);
  const game = container.resolve(Game);
  const careers = container.resolve(CareerSystem);
  const random = container.resolve(RandomService);
  const bus = container.resolve(TypedEventBus);
  const achievements = container.resolve(AchievementRegistry);

  const rootId = lm.getRootWorldIds()[0] ?? "classic";

  const eventHits = new Map<string, number>();
  bus.on("incident:executed", ({ incidentId }) => {
    eventHits.set(incidentId, (eventHits.get(incidentId) ?? 0) + 1);
  });

  // The full event universe: collect each level's ids the moment it loads
  // (levels are disposed when left, so a post-hoc scan would miss them).
  const universe = new Set<string>();
  bus.on("level:started", ({ levelId }) => {
    const level = lm.getLevel(levelId);
    if (!level) return;
    for (const range of level.eventCenter.getAllRanges()) {
      level.eventCenter.getIncidentsByRange(range)?.forEach((inc) => universe.add(inc.id));
    }
  });

  let dead = 0;
  let survived = 0;
  let ageSum = 0;
  let firedCount = 0;
  let livesFired = 0;
  let firedThisLife = false;
  bus.on("career:fired", () => {
    firedCount++;
    firedThisLife = true;
  });
  const ages: number[] = [];
  // Body + mind aggregates. A single seeded life cannot show a degenerate
  // distribution — "everyone is depressed by 40" only appears across 200 of
  // them, and it shows up here as a collapsed lifespan before it shows up as a
  // number anyone would notice.
  let maxWeight = 0;
  let depressed = 0;
  let addicted = 0;
  let grieved = 0;
  const weights: number[] = [];
  const appearances: number[] = [];
  const fitnesses: number[] = [];

  for (let i = 0; i < LIVES; i++) {
    random.journaling = false;
    random.setNextSeed((BASE_SEED + i) >>> 0);
    firedThisLife = false;
    lm.start(rootId);

    const player = lm.getPlayer();
    let guard = 0;
    while (player.alive && player.age <= 100 && guard < 900) {
      guard++;
      if (player.weight > maxWeight) maxWeight = player.weight;
      const pc = lm.getPendingChoice();
      if (pc) {
        const opt = pc.options.find((o) => !o.disabled) ?? pc.options[0];
        if (!opt) break;
        lm.resolveChoice(opt.def.id);
      } else {
        // Take a job the way a player does — through the board. There is no
        // action for it any more, so without this the harness never employed
        // anyone and the entire career system went unexercised.
        if (!player.careerId) {
          const job = careers.getBoard(player).find((c) => c.state === "available");
          if (job) careers.join(player, job.id);
        }
        const avail = game.getActionViews().find((a) => a.available);
        if (avail) game.performAction(avail.def.id);
        game.endTurn();
      }
    }

    const state = container.resolve(HealthSystem).getState();
    if (state.conditions.cond_depression) depressed++;
    if (Object.keys(state.addictions).length > 0) addicted++;
    if (state.trauma > 0) grieved++;
    if (firedThisLife) livesFired++;
    weights.push(player.weight);
    appearances.push(player.appearance);
    fitnesses.push(player.fitness);
    ages.push(player.age);
    ageSum += player.age;
    if (player.alive) survived++;
    else dead++;
    random.journaling = true;
  }

  const ranked = [...eventHits.entries()].sort((a, b) => b[1] - a[1]);
  const neverFired = [...universe].filter((id) => !eventHits.has(id));
  ages.sort((a, b) => a - b);
  weights.sort((a, b) => a - b);
  appearances.sort((a, b) => a - b);
  fitnesses.sort((a, b) => a - b);
  const median = medianOf(ages);

  console.log(`[monte-carlo]  ${LIVES} lives  base-seed=${BASE_SEED}`);
  console.log(
    `  lifespan: mean=${(ageSum / LIVES).toFixed(1)} median=${median} died=${pct(
      dead,
      LIVES,
    )} survived=${pct(survived, LIVES)}`,
  );
  // Percentiles, because a mean hides the shape: "everyone lives to a hundred"
  // and "half die at forty, half at a hundred" have the same mean.
  console.log(
    `  ages: p10=${quantile(ages, 0.1)} p25=${quantile(ages, 0.25)} ${median} p75=${quantile(
      ages,
      0.75,
    )} p90=${quantile(ages, 0.9)} max=${ages[ages.length - 1] ?? 0}  (median shown plain)`,
  );
  console.log(
    `  achievements registered=${achievements.getAllAchievements().length}`,
  );
  console.log(
    `  events: distinct fired=${ranked.length}  never fired=${neverFired.length}/${universe.size}`,
  );
  console.log(
    `  body: weight median=${medianOf(weights).toFixed(1)} max-ever=${maxWeight.toFixed(
      1,
    )}  appearance median=${medianOf(appearances).toFixed(0)}  fitness median=${medianOf(
      fitnesses,
    ).toFixed(0)}`,
  );
  console.log(
    `  mind: depressed=${pct(depressed, LIVES)}  addicted=${pct(addicted, LIVES)}  carried grief=${pct(
      grieved,
      LIVES,
    )}`,
  );
  console.log(
    `  work: fired-in-a-life ${(firedCount / LIVES).toFixed(2)}  lives with a firing ${pct(
      livesFired,
      LIVES,
    )}`,
  );
  // Which couplings actually drive the numbers. A rule firing every single
  // year is a rule that is not a consequence, it is a tax.
  const couplings = [...container.resolve(VitalsSystem).fireCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  console.log("[couplings / life]");
  for (const [id, count] of couplings.slice(0, 12)) {
    console.log(`  ${(count / LIVES).toFixed(2).padStart(7)}/life  ${id}`);
  }

  console.log("[top events / life]");
  for (const [id, count] of ranked.slice(0, 15)) {
    console.log(`  ${(count / LIVES).toFixed(2).padStart(7)}/life  ${id}`);
  }

  console.log("[rare events] (< 0.5% of lives)");
  const rare = ranked
    .filter(([, c]) => c / LIVES < 0.005)
    .slice(-15)
    .reverse();
  if (rare.length === 0) console.log("  (none)");
  for (const [id, count] of rare) {
    console.log(`  ${(count / LIVES).toFixed(3).padStart(7)}/life  ${id}`);
  }

  if (neverFired.length > 0) {
    console.log(`[never fired]  ${neverFired.slice(0, 30).join(", ")}`);
  }

  restore();
}

main().catch((err) => {
  restore();
  console.error("MONTE-CARLO THREW:", err);
  process.exit(1);
});
