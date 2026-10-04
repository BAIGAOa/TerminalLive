import { container } from "../../Container.js";
import Player from "../../world/Player.js";
import ConfigStore from "../store/ConfigStore.js";
import LevelManager from "../../level/LevelManager.js";
import ThemeManager from "../theme/ThemeManager.js";
import EventHistory from "../../event/EventHistory.js";
import AchievementManager from "../../achievement/AchievementManager.js";
import { VersionProvider } from "../version/VersionProvider.js";
import WorldState from "../../world/chronicle/WorldState.js";
import PressureState from "../../world/pressures/PressureState.js";
import WeatherState from "../../world/weather/WeatherState.js";
import { SaveData } from "./SaveSchema.js";

/**
 * Snapshot the entire living game into a `SaveData`. Resolves every dependency
 * from the container so archives and the auto-save share one source of truth.
 */
export function captureSaveData(): SaveData {
  const levelManager = container.resolve(LevelManager);
  const configStore = container.resolve(ConfigStore);
  const achievementManager = container.resolve(AchievementManager);
  const versionProvider = container.resolve(VersionProvider);
  const player = levelManager.getPlayer();
  const currentHistory = levelManager.getCurrentEventHistory();
  const pending = levelManager.getPendingChoice();

  return {
    version: 4,
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
    history: {
      triggered: Array.from(currentHistory?.getTriggered() ?? []),
      blocked: Array.from(currentHistory?.getBlocked() ?? []),
      rangeRecord: serializeRangeRecord(currentHistory),
    },
    achievements: achievementManager.getState(),
    config: {
      language: configStore.getLanguage(),
      theme: configStore.getTheme(),
      enabledMods: configStore.getEnabledMods(),
      traits: configStore.getTraits(),
    },
    levels: {
      currentLevel: levelManager.getCurrentLevelId() ?? "none",
      completedLevels: levelManager.getCompletedLevelIds(),
    },
    world: container.resolve(WorldState).toSnapshot(),
    pressures: container.resolve(PressureState).snapshot(),
    weather: container.resolve(WeatherState).snapshot(),
    pendingChoice: pending
      ? { incidentId: pending.incidentId, rangeKey: pending.rangeKey }
      : null,
  };
}

/**
 * Apply a `SaveData` onto the live singletons in place (no restart). The caller
 * is responsible for re-entering the saved level afterwards.
 */
export function applySaveData(data: SaveData): void {
  const configStore = container.resolve(ConfigStore);
  const themeManager = container.resolve(ThemeManager);
  const levelManager = container.resolve(LevelManager);
  const achievementManager = container.resolve(AchievementManager);
  const eventHistory = container.resolve(EventHistory);
  const player: Player = levelManager.getPlayer();

  configStore.update({
    language: data.config.language,
    theme: data.config.theme ?? "default",
    enabledMods: data.config.enabledMods,
    traits: data.config.traits,
    player: data.player,
    lastLevelId: data.levels.currentLevel,
    completedLevels: data.levels.completedLevels,
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

  eventHistory.restoreFromArchive(data.history);
  eventHistory.save();

  achievementManager.setState(data.achievements);
  achievementManager.persist();

  levelManager.initCompletedLevels(data.levels.completedLevels);
}

function serializeRangeRecord(
  history: ReturnType<LevelManager["getCurrentEventHistory"]>,
): Record<string, string[]> {
  const record = history?.getRangeKeyRecord();
  const result: Record<string, string[]> = {};
  if (record) {
    for (const [key, set] of record) {
      result[key] = Array.from(set);
    }
  }
  return result;
}
