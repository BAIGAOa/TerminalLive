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

async function main() {
  backup();
  await container.resolve(GameInitialization).init();

  const lm = container.resolve(WorldManager);
  const game = container.resolve(Game);
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
  const ages: number[] = [];

  for (let i = 0; i < LIVES; i++) {
    random.journaling = false;
    random.setNextSeed((BASE_SEED + i) >>> 0);
    lm.start(rootId);

    const player = lm.getPlayer();
    let guard = 0;
    while (player.alive && player.age <= 100 && guard < 900) {
      guard++;
      const pc = lm.getPendingChoice();
      if (pc) {
        const opt = pc.options.find((o) => !o.disabled) ?? pc.options[0];
        if (!opt) break;
        lm.resolveChoice(opt.def.id);
      } else {
        const avail = game.getActionViews().find((a) => a.available);
        if (avail) game.performAction(avail.def.id);
        game.endTurn();
      }
    }

    ages.push(player.age);
    ageSum += player.age;
    if (player.alive) survived++;
    else dead++;
    random.journaling = true;
  }

  const ranked = [...eventHits.entries()].sort((a, b) => b[1] - a[1]);
  const neverFired = [...universe].filter((id) => !eventHits.has(id));
  ages.sort((a, b) => a - b);
  const median = ages[Math.floor(ages.length / 2)] ?? 0;

  console.log(`[monte-carlo]  ${LIVES} lives  base-seed=${BASE_SEED}`);
  console.log(
    `  lifespan: mean=${(ageSum / LIVES).toFixed(1)} median=${median} died=${pct(
      dead,
      LIVES,
    )} survived=${pct(survived, LIVES)}`,
  );
  console.log(
    `  achievements registered=${achievements.getAllAchievements().length}`,
  );
  console.log(
    `  events: distinct fired=${ranked.length}  never fired=${neverFired.length}/${universe.size}`,
  );

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
