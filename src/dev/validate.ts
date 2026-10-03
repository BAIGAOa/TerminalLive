/**
 * Headless engine + content integration check. Initialises the full game
 * (config, levels, items, npcs, actions, effects, achievements), walks the
 * level chain, then simulates a whole life by ending turns and auto-resolving
 * choices. Exits non-zero on any failed assertion.
 *
 * Run with: npm run test:engine   (builds, then runs dist/dev/validate.js)
 */
import { container } from "../Container.js";
import GameInitialization from "../core/GameInitialization.js";
import LevelManager from "../level/LevelManager.js";
import ItemRegistry from "../world/items/ItemRegistry.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import AchievementRegistry from "../core/registry/AchievementRegistry.js";
import ActionRegistry from "../game/actions/ActionRegistry.js";
import EffectRegistry from "../world/effects/EffectRegistry.js";
import Game from "../core/Game.js";
import { readFileSync, writeFileSync } from "node:fs";
import { resourcePath } from "../core/paths.js";

let failures = 0;
function check(label: string, cond: boolean, detail = ""): void {
  const mark = cond ? "[OK]" : "[FAIL]";
  if (!cond) failures++;
  console.log(`  ${mark} ${label}${detail ? `  (${detail})` : ""}`);
}

// The simulation persists user data (config, unlocked achievements, history);
// snapshot those files so the run leaves the repo untouched.
const PERSISTED = [
  "config.json",
  "achievement/unlocked.json",
  "history.json",
];
const backups = new Map<string, string>();
function backupPersisted(): void {
  for (const rel of PERSISTED) {
    try {
      backups.set(rel, readFileSync(resourcePath(rel), "utf8"));
    } catch {
      /* file may not exist yet */
    }
  }
}
function restoreConfig(): void {
  for (const [rel, content] of backups) {
    try {
      writeFileSync(resourcePath(rel), content, "utf8");
    } catch {
      /* ignore */
    }
  }
}
// Fire last — after any pending async persistence has flushed.
process.on("exit", restoreConfig);

async function main() {
  backupPersisted();
  await container.resolve(GameInitialization).init();
  const lm = container.resolve(LevelManager);
  const game = container.resolve(Game);

  console.log("[content]");
  const levels = lm.getAllLevels();
  check("levels loaded", levels.size >= 5, [...levels.keys()].join(","));
  check("items loaded", container.resolve(ItemRegistry).getAll().length >= 10);
  check("npcs loaded", container.resolve(NpcRegistry).getAll().length >= 6);
  check("actions loaded", container.resolve(ActionRegistry).getAll().length >= 10);
  check("effects loaded", container.resolve(EffectRegistry).getAll().length >= 8);
  check(
    "achievements loaded",
    container.resolve(AchievementRegistry).getAllAchievements().length >= 10,
  );

  // Level chain must resolve childhood → ... → none.
  let id: string | "none" = "childhood";
  const seen = new Set<string>();
  while (id !== "none" && levels.has(id) && !seen.has(id)) {
    seen.add(id);
    id = levels.get(id)!.nextLevel;
  }
  check("level chain resolves to the end", id === "none", `ended at ${id}`);

  console.log("[simulation]");
  lm.start("childhood");
  const ranges = lm.current.eventCenter.getAllRanges();
  check("events registered for the level", ranges.length >= 20, `${ranges.length}`);

  const player = lm.getPlayer();
  let choices = 0;
  let actions = 0;
  let guard = 0;
  while (player.alive && player.age <= 100 && guard < 800) {
    guard++;

    const pc = lm.getPendingChoice();
    if (pc) {
      choices++;
      const opt = pc.options.find((o) => !o.disabled) ?? pc.options[0];
      if (!opt) {
        check(`choice ${pc.incidentId} has an option`, false);
        break;
      }
      lm.resolveChoice(opt.def.id);
    } else {
      const avail = game.getActionViews().find((a) => a.available);
      if (avail && game.performAction(avail.def.id)) actions++;
      lm.update();
    }

    if (lm.isCurrentCleared() && lm.current.nextLevel !== "none") {
      if (!game.goToNextLevel()) break;
    }
  }

  check("choices were offered and resolved", choices > 0, `${choices}`);
  check("actions were performed", actions > 0, `${actions}`);
  check("life reached old age or death", player.age >= 20, `age ${player.age}`);

  const ach = container.resolve(AchievementRegistry).getAllAchievements();
  console.log("[final state]");
  console.log(
    `  age ${player.age}  alive ${player.alive}  hp ${Math.round(player.health)}  $${player.money}`,
  );
  console.log(
    `  skills int=${player.intelligence} soc=${player.social} fit=${player.fitness} hap=${Math.round(player.happiness)}`,
  );
  console.log(
    `  effects=[${player.activeEffects.map((e) => e.id).join(",")}] inventory=[${player.inventory
      .map((i) => `${i.id}x${i.count}`)
      .join(",")}]`,
  );
  console.log(
    `  flags=[${[...player.flags].join(",")}] relationships=${player.relationships.size}`,
  );
  console.log(`  achievements registered: ${ach.length}`);

  restoreConfig();
  if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
  console.log("\nALL CHECKS PASSED");
}

main().catch((err) => {
  restoreConfig();
  console.error("VALIDATION THREW:", err);
  process.exit(1);
});
