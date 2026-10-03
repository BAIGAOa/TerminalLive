import { useSyncExternalStore } from "react";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import WorldState from "../world/chronicle/WorldState.js";
import PressureState from "../world/pressures/PressureState.js";
import PressureRegistry from "../world/pressures/PressureRegistry.js";
import WeatherState from "../world/weather/WeatherState.js";
import { seasonOf } from "../world/weather/WeatherDefinition.js";
import LevelManager from "../level/LevelManager.js";
import { buildNarrative, deriveMood } from "../world/narrative/compose.js";

/**
 * A prose "scene" describing the current year, woven from the living world
 * (weather, era, region, the strongest hidden-score swing) and the player's
 * mood. Returns resolved translation lines to lay out as a paragraph.
 */
export default function useNarrative(): string[] {
  const { t } = useI18n();
  const world = container.resolve(WorldState);
  const pressures = container.resolve(PressureState);
  const pressureReg = container.resolve(PressureRegistry);
  const weather = container.resolve(WeatherState);
  const player = container.resolve(LevelManager).getPlayer();

  useSyncExternalStore(world.subscribe, world.getSnapshot);
  useSyncExternalStore(pressures.subscribe, pressures.getSnapshot);
  useSyncExternalStore(weather.subscribe, weather.getSnapshot);
  useSyncExternalStore(player.subscribe, () =>
    `${player.age}|${player.health}|${player.happiness}|${player.activeEffects
      .map((e) => e.id)
      .join(",")}`,
  );

  const pressureList = pressureReg.getAxes().map((a) => ({
    id: a.id,
    cls: a.class,
    value: pressures.get(a.id),
  }));

  const segments = buildNarrative({
    year: world.year,
    eraId: world.eraId,
    regionId: world.regionId,
    weatherId: weather.currentIdValue(),
    season: seasonOf(world.year),
    karma: world.karma,
    pressures: pressureList,
    mood: deriveMood({
      health: player.health,
      happiness: player.happiness,
      effectIds: player.activeEffects.map((e) => e.id),
    }),
  });

  return segments.map((s) => t(s.key, s.params));
}
