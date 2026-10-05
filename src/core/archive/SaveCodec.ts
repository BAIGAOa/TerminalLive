import { container } from "../../Container.js";
import Player from "../../world/Player.js";
import ConfigStore from "../store/ConfigStore.js";
import WorldManager from "../../worlds/WorldManager.js";
import ThemeManager from "../theme/ThemeManager.js";
import AchievementManager from "../../achievement/AchievementManager.js";
import { VersionProvider } from "../version/VersionProvider.js";
import WorldState from "../../world/chronicle/WorldState.js";
import PressureState from "../../world/pressures/PressureState.js";
import WeatherState from "../../world/weather/WeatherState.js";
import NpcSimulation from "../../world/relationships/NpcSimulation.js";
import CareerSystem from "../../world/careers/CareerSystem.js";
import EconomySystem from "../../world/economy/EconomySystem.js";
import HealthSystem from "../../world/health/HealthSystem.js";
import PoliticsSystem from "../../world/politics/PoliticsSystem.js";
import RegionsSystem from "../../world/regions/RegionsSystem.js";
import WorldChainSystem from "../../world/chains/WorldChainSystem.js";
import NarrativeSystem from "../../world/narrative/NarrativeSystem.js";
import RandomService from "../random/RandomService.js";
import WorldContentLoader from "../../worlds/WorldContentLoader.js";
import ChainTracker from "../../event/ChainTracker.js";
import EventDirector from "../../event/EventDirector.js";
import { SaveData } from "./SaveSchema.js";
import { SAVE_VERSION } from "./migrations.js";

/**
 * Snapshot the entire living game into a `SaveData`. Resolves every dependency
 * from the container so archives and the auto-save share one source of truth.
 */
export function captureSaveData(): SaveData {
  const levelManager = container.resolve(WorldManager);
  const configStore = container.resolve(ConfigStore);
  const achievementManager = container.resolve(AchievementManager);
  const versionProvider = container.resolve(VersionProvider);
  const player = levelManager.getPlayer();
  const currentHistory = levelManager.getCurrentEventHistory();
  const pending = levelManager.getPendingChoice();

  return {
    version: SAVE_VERSION,
    appVersion: versionProvider.version,
    timestamp: new Date().toISOString(),
    player: {
      playerName: player.playerName,
      age: player.age,
      health: player.health,
      height: player.height,
      weight: player.weight,
      money: player.money,
      intelligence: player.intelligence,
      social: player.social,
      fitness: player.fitness,
      happiness: player.happiness,
      reputation: player.reputation,
      angerValue: player.angerValue,
      excitationValue: player.excitationValue,
      depressionValue: player.depressionValue,
      weakValue: player.weakValue,
      effects: player.activeEffects.map((e) => ({ ...e })),
      inventory: player.inventory.map((s) => ({ ...s })),
      relationships: Object.fromEntries(player.relationships),
      flags: Array.from(player.flags),
      actionPoints: player.actionPoints,
      careerId: player.careerId,
      careerRank: player.careerRank,
    },
    history: currentHistory?.toArchiveData() ?? {
      triggered: [],
      blocked: [],
      rangeRecord: {},
      triggeredAge: {},
      categoryAge: {},
      lastId: null,
      consecutiveCount: 0,
    },
    achievements: achievementManager.getState(),
    config: {
      language: configStore.getLanguage(),
      theme: configStore.getTheme(),
      enabledMods: configStore.getEnabledMods(),
      traits: configStore.getTraits(),
    },
    run: {
      worldId: levelManager.getCurrentWorldId(),
      worldContentVersion: levelManager.getCurrentWorld()?.contentVersion ?? 1,
    },
    worldObjectives: {
      worldId: levelManager.getCurrentWorldId(),
      completed: levelManager.getCompletedObjectiveIds(),
    },
    world: container.resolve(WorldState).toSnapshot(),
    pressures: container.resolve(PressureState).snapshot(),
    weather: container.resolve(WeatherState).snapshot(),
    npcSim: container.resolve(NpcSimulation).snapshot(),
    career: container.resolve(CareerSystem).snapshot(),
    economy: container.resolve(EconomySystem).snapshot(),
    health: container.resolve(HealthSystem).snapshot(),
    politics: container.resolve(PoliticsSystem).snapshot(),
    regions: container.resolve(RegionsSystem).snapshot(),
    chains: container.resolve(WorldChainSystem).snapshot(),
    narrative: container.resolve(NarrativeSystem).snapshot(),
    random: container.resolve(RandomService).snapshot(),
    chain: container.resolve(ChainTracker).snapshot(),
    // Queued post-event steps — without these a delayed / gated narrative line
    // dies on save/load. Captured from the active world's algorithm.
    postEvents: levelManager.getCurrentWorld()?.algorithm.snapshotPostEvents?.() ?? [],
    director: container.resolve(EventDirector).snapshot(),
    pendingChoice: pending
      ? { incidentId: pending.incidentId, rangeKey: pending.rangeKey }
      : null,
  };
}

/**
 * Apply a `SaveData` onto the live singletons in place (no restart). The caller
 * is responsible for re-entering the saved level afterwards.
 */
export function applySaveData(data: SaveData): boolean {
  const configStore = container.resolve(ConfigStore);
  const themeManager = container.resolve(ThemeManager);
  const levelManager = container.resolve(WorldManager);
  const achievementManager = container.resolve(AchievementManager);

  // Identity guard: refuse a save whose world is gone or has changed content.
  const worldId = data.run.worldId;
  if (worldId) {
    const world = levelManager.getWorld(worldId);
    if (!world || world.contentVersion !== data.run.worldContentVersion) {
      console.warn(
        `[Save] 世界 "${worldId}" 不存在或内容版本不符（存档 v${data.run.worldContentVersion}），已放弃加载`,
      );
      return false;
    }
    // Install the saved world's scoped content BEFORE restoring subsystem
    // state below. The chronicle/weather/pressure/npc registries must hold
    // THIS world's definitions, or the restores resolve against the classic
    // baseline (wrong eras/regions/axes, dropped world events).
    container.resolve(WorldContentLoader).loadFor(world);
  }

  const player: Player = levelManager.getPlayer();

  configStore.update({
    language: data.config.language,
    theme: data.config.theme ?? "default",
    enabledMods: data.config.enabledMods,
    traits: data.config.traits,
    player: data.player,
    lastWorldId: data.run.worldId ?? undefined,
    // Kept as a one-release alias for older readers.
    lastLevelId: data.run.worldId ?? undefined,
  });

  if (data.config.theme) {
    try {
      themeManager.setCurrent(data.config.theme);
    } catch {
      themeManager.setCurrent("default");
    }
  }

  player.applyAttributes(data.player);
  player.activeEffects = data.player.effects.map((e) => ({ ...e }));
  player.inventory = data.player.inventory.map((s) => ({ ...s }));
  player.relationships = new Map(Object.entries(data.player.relationships));
  player.flags = new Set(data.player.flags);
  player.actionPoints = data.player.actionPoints;
  player.careerId = data.player.careerId;
  player.careerRank = data.player.careerRank;
  // Derive life status from health so a 0-HP save doesn't reload as alive.
  player.alive = player.health > 0;

  // Restore the living world (era, region, karma, standing, lore, fates),
  // the hidden-score web, and the weather.
  container.resolve(WorldState).restore(data.world, player.flags);
  container.resolve(PressureState).restore(data.pressures);
  container.resolve(WeatherState).restore(data.weather);
  container.resolve(NpcSimulation).restore(data.npcSim);
  container.resolve(CareerSystem).restore(data.career);
  container.resolve(EconomySystem).restore(data.economy);
  container.resolve(HealthSystem).restore(data.health);
  container.resolve(PoliticsSystem).restore(data.politics);
  container.resolve(RegionsSystem).restore(data.regions);
  container.resolve(WorldChainSystem).restore(data.chains);
  container.resolve(NarrativeSystem).restore(data.narrative);
  // Resume the exact same random stream (seed + step), graph and streak memory.
  container.resolve(RandomService).restore(data.random);
  container.resolve(ChainTracker).restore(data.chain);
  container.resolve(EventDirector).restore(data.director);
  // Restore queued post-event steps onto the SAVED world's algorithm (not the
  // currently-active one). Events are loaded when that world is re-entered, so
  // the queue stays closure-free here and re-resolves its edges at fire time.
  if (worldId) {
    levelManager.getWorld(worldId)?.algorithm.restorePostEvents?.(data.postEvents);
  }

  // Per-level event history is restored when the level is re-entered (each
  // level owns its own EventHistory), so hand the blob to WorldManager.
  levelManager.setPendingHistory(data.history);

  achievementManager.setState(data.achievements);
  achievementManager.persist();

  // Restore per-world objective progress so rewards aren't granted twice.
  if (data.worldObjectives.worldId) {
    levelManager.restoreObjectives(
      data.worldObjectives.worldId,
      data.worldObjectives.completed,
    );
  }
  return true;
}
