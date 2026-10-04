import { useSyncExternalStore } from "react";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import WorldState from "../world/chronicle/WorldState.js";
import PressureState from "../world/pressures/PressureState.js";
import PressureRegistry from "../world/pressures/PressureRegistry.js";
import WeatherState from "../world/weather/WeatherState.js";
import { seasonOf } from "../world/weather/WeatherDefinition.js";
import LevelManager from "../level/LevelManager.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import CareerSystem from "../world/careers/CareerSystem.js";
import NarrativeSystem from "../world/narrative/NarrativeSystem.js";
import {
  buildNarrative,
  deriveMood,
  NarrativeMemory,
} from "../world/narrative/compose.js";

/**
 * A prose "scene" describing the current year, woven from the living world
 * (weather, era, region, the strongest hidden-score swing), the player's mood,
 * and what the narrator remembers — a recent happening, a bond, a calling, an
 * active through-line. Returns resolved translation lines.
 */
// Stable fallbacks — a fresh array/closure each render breaks useSyncExternalStore.
const NO_SUB = () => () => {};
const EMPTY_LOGS: never[] = [];
const NO_SNAP = () => EMPTY_LOGS;

export default function useNarrative(): string[] {
  const { t } = useI18n();
  const levelManager = container.resolve(LevelManager);
  const world = container.resolve(WorldState);
  const pressures = container.resolve(PressureState);
  const pressureReg = container.resolve(PressureRegistry);
  const weather = container.resolve(WeatherState);
  const npcReg = container.resolve(NpcRegistry);
  const careers = container.resolve(CareerSystem);
  const narrative = container.resolve(NarrativeSystem);
  const player = levelManager.getPlayer();
  const logStore = levelManager.getCurrentLogStore();

  useSyncExternalStore(world.subscribe, world.getSnapshot);
  useSyncExternalStore(pressures.subscribe, pressures.getSnapshot);
  useSyncExternalStore(weather.subscribe, weather.getSnapshot);
  useSyncExternalStore(
    logStore?.subscribe ?? NO_SUB,
    logStore?.getSnapshot ?? NO_SNAP,
  );
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

  // ── memory: what the narrator can call back to ──
  const recentEvents = (logStore?.getSnapshot() ?? [])
    .slice(0, 3)
    .map((e) => t(e.incident.nameKey ?? e.incident.id));

  let topId: string | null = null;
  let topVal = 0;
  for (const [id, v] of player.relationships) {
    if (v > topVal) {
      topVal = v;
      topId = id;
    }
  }
  const career = careers.getState(player);
  const arcs = narrative.getArcs();

  const memory: NarrativeMemory = {
    recentEvents,
    topNpc: topId ? t(npcReg.get(topId)?.labelKey ?? topId) : undefined,
    topNpcAffinity: topId ? Math.round(topVal) : undefined,
    career: career ? t(career.career.labelKey) : undefined,
    careerRank: career ? career.rank + 1 : undefined,
    arc: arcs[0] ? t(arcs[0].def.labelKey) : undefined,
  };

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
    memory,
  });

  return segments.map((s) => t(s.key, s.params));
}
