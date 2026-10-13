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
import WorldManager from "../worlds/WorldManager.js";
import ItemRegistry from "../world/items/ItemRegistry.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import type { NpcDefinition } from "../world/relationships/NpcDefinition.js";
import GenesisService from "../world/ai/GenesisService.js";
import AchievementRegistry from "../core/registry/AchievementRegistry.js";
import ActionRegistry from "../game/actions/ActionRegistry.js";
import EffectRegistry from "../world/effects/EffectRegistry.js";
import HealthSystem from "../world/health/HealthSystem.js";
import VitalsSystem from "../world/VitalsSystem.js";
import ConfigStore from "../core/store/ConfigStore.js";
import {
  WEIGHT_MAX,
  WEIGHT_MIN,
  formatHeight,
  formatWeight,
} from "../world/vitalsEngine.js";
import Game from "../core/Game.js";
import TypedEventBus from "../core/TypedEventBus.js";
import AutoSave from "../core/archive/AutoSave.js";
import RandomService from "../core/random/RandomService.js";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resourcePath } from "../core/paths.js";

// Auto-save to a throwaway file so the run never touches the real life slot.
const AUTOSAVE_TMP = `${tmpdir()}/tl-engine-${process.pid}.json`;
process.env.TL_AUTOSAVE = AUTOSAVE_TMP;

// Deterministic RNG (mulberry32) so the simulated life and the probabilistic
// checks that depend on it are reproducible run-to-run instead of flaking.
let __seed = 0x2f6e2b1;
Math.random = () => {
  __seed = (__seed + 0x6d2b79f5) | 0;
  let t = Math.imul(__seed ^ (__seed >>> 15), 1 | __seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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
  try {
    rmSync(AUTOSAVE_TMP, { force: true });
  } catch {
    /* ignore */
  }
}
// Fire last — after any pending async persistence has flushed.
process.on("exit", restoreConfig);

async function main() {
  backupPersisted();
  await container.resolve(GameInitialization).init();
  // Force the harness offline: a configured API key turns every run into a
  // network test, and the point of this file is that a seed replays the same.
  const config = container.resolve(ConfigStore);
  await config.setDeepseekApiKey("");
  await config.setMailFrequency("off");
  const lm = container.resolve(WorldManager);
  const game = container.resolve(Game);

  console.log("[content]");
  const levels = lm.getAllWorlds();
  check("levels loaded", levels.size >= 5, [...levels.keys()].join(","));
  check("items loaded", container.resolve(ItemRegistry).getAll().length >= 10);
  check("npcs loaded", container.resolve(NpcRegistry).getAll().length >= 6);
  check("actions loaded", container.resolve(ActionRegistry).getAll().length >= 10);
  check("effects loaded", container.resolve(EffectRegistry).getAll().length >= 8);
  check(
    "achievements loaded",
    container.resolve(AchievementRegistry).getAllAchievements().length >= 10,
  );

  // One world = one life: all worlds load, and there is a startable root.
  check("worlds loaded", levels.size >= 10, `${levels.size}`);
  check("a root world exists", lm.getRootWorldIds().length >= 1, lm.getRootWorldIds().join(","));

  console.log("[simulation]");
  // Pin the seeded RNG (the game no longer reads Math.random), so this life is
  // byte-for-byte reproducible run to run.
  container.resolve(RandomService).reseed(0x2f6e2b1);
  container.resolve(RandomService).setNextSeed(0x2f6e2b1);
  lm.start("classic");
  const ranges = lm.current.eventCenter.getAllRanges();
  check("events registered for the level", ranges.length >= 20, `${ranges.length}`);

  const player = lm.getPlayer();
  const autoSave = container.resolve(AutoSave);
  const bus = container.resolve(TypedEventBus);
  let npcActed = 0;
  let npcInteractions = 0;
  let npcOffers = 0;
  bus.on("npc:acted", () => {
    npcActed++;
  });
  bus.on("npc:interaction", () => {
    npcInteractions++;
  });
  bus.on("choice:resolved", ({ incidentId }) => {
    if (incidentId.startsWith("npc_offer_")) npcOffers++;
  });
  let choices = 0;
  let actions = 0;
  let guard = 0;
  let midLifeSaved = false;
  while (player.alive && player.age <= 100 && guard < 800) {
    guard++;

    // Register one invented character by hand before the save. The AI path
    // needs an API key, but the *persistence* path is the same code either way,
    // and this is the only place that runs it end to end — `loadFor` rebuilds
    // the NPC registry from disk, so without the generated definitions being
    // carried in the save and re-registered in the right window, this character
    // would simply be gone after a reload.
    if (guard === 8 && !container.resolve(NpcRegistry).has("ai_npc_probe")) {
      const genesis = container.resolve(GenesisService);
      const synthetic: NpcDefinition = {
        id: "ai_npc_probe",
        labelKey: "Probe",
        descKey: "A character invented for this check.",
        type: "friend",
        roleKey: "npc.role.friend",
        initial: 12,
        knownFromAge: player.age,
        // Deliberately unlike the friend role default, so a restore that falls
        // back to `ROLE_TRAITS` is caught rather than passing by accident.
        params: {
          traits: { warmth: -0.5, ambition: 0.9, stability: 0.1, sociability: 0.2 },
        },
      };
      genesis.restore({
        npcs: [synthetic],
        events: [],
        worldId: lm.getCurrentWorldId(),
        lastNpcAt: player.age,
        lastEventAt: -999,
      });
      genesis.registerPersisted(lm.getCurrentWorldId());
      const reg = container.resolve(NpcRegistry);
      check("an invented character registers", reg.has("ai_npc_probe"));
      check(
        "their personality is the one given, not the role default",
        reg.get("ai_npc_probe")?.traits().warmth === -0.5,
        `warmth ${reg.get("ai_npc_probe")?.traits().warmth}`,
      );
    }

    // Mid-life: prove the auto-save round-trips the live state.
    if (guard === 12 && player.alive && lm.hasActiveWorld()) {
      autoSave.save();
      check("auto-save written mid-life", autoSave.exists());
      const blob = JSON.parse(readFileSync(AUTOSAVE_TMP, "utf8"));
      check("auto-save age matches live player", blob.player.age === player.age);
      check(
        "auto-save records the current world",
        blob.run.worldId === lm.getCurrentWorldId(),
      );
      const reloaded = autoSave.load();
      check(
        "auto-save reloads in place",
        !!reloaded && reloaded.player.age === player.age,
      );
      const afterLoad = container.resolve(NpcRegistry);
      check(
        "an invented character survives a save round-trip",
        afterLoad.has("ai_npc_probe"),
      );
      check(
        "…with their personality intact (not reverted to the role default)",
        afterLoad.get("ai_npc_probe")?.traits().sociability === 0.2,
        `sociability ${afterLoad.get("ai_npc_probe")?.traits().sociability}`,
      );
      midLifeSaved = true;
    }

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
      // Occasionally interact with a known NPC to exercise the relationship layer.
      const npcId = [...player.relationships.keys()].find(
        (id) => player.getRelationship(id) > 0,
      );
      if (npcId && player.actionPoints > 0) {
        game.interactWithNpc(npcId, "it_talk");
      }
      const avail = game.getActionViews().find((a) => a.available);
      if (avail && game.performAction(avail.def.id)) actions++;
      game.endTurn();
    }
  }

  check("choices were offered and resolved", choices > 0, `${choices}`);
  check("actions were performed", actions > 0, `${actions}`);
  check("life reached old age or death", player.age >= 20, `age ${player.age}`);
  check("mid-life auto-save happened", midLifeSaved);
  check("NPCs acted on their own", npcActed > 0, `${npcActed}`);
  check("an NPC offer was answered", npcOffers > 0, `${npcOffers}`);
  check("played an NPC interaction", npcInteractions > 0, `${npcInteractions}`);
  // A life that ended must not leave a resumable auto-save behind.
  if (!player.alive) {
    check("auto-save cleared when the life ends", !autoSave.exists());
  }

  const ach = container.resolve(AchievementRegistry).getAllAchievements();
  console.log("[final state]");
  console.log(
    `  age ${player.age}  alive ${player.alive}  hp ${Math.round(player.health)}  $${player.money}`,
  );
  console.log(
    `  skills int=${player.intelligence} soc=${player.social} fit=${player.fitness} hap=${Math.round(player.happiness)}`,
  );
  // Body and mind used to be invisible here, which meant the couplings that
  // move them could degenerate without the harness noticing.
  const health = container.resolve(HealthSystem).getState();
  console.log(
    `  body h=${formatHeight(player.height)} w=${formatWeight(player.weight)} look=${Math.round(
      player.appearance,
    )}  mind dep=${Math.round(player.depressionValue)} ang=${Math.round(
      player.angerValue,
    )} weak=${Math.round(player.weakValue)}`,
  );
  console.log(
    `  conditions=[${Object.keys(health.conditions).join(",")}] addictions=[${Object.keys(
      health.addictions,
    ).join(",")}] trauma=${Math.round(health.trauma)} resilience=${Math.round(
      health.resilience,
    )}`,
  );
  check(
    "body stayed inside its band",
    player.weight <= WEIGHT_MAX && player.weight >= WEIGHT_MIN,
    `w=${formatWeight(player.weight)}`,
  );
  check(
    "weight drifted at all (it used to be frozen)",
    Math.abs(player.weight - 45) > 0.05 || player.age < 30,
    `w=${formatWeight(player.weight)}`,
  );
  const couplings = [...container.resolve(VitalsSystem).fireCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );
  console.log(
    `  couplings: ${couplings.map(([id, n]) => `${id}x${n}`).join(" ")}`,
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
