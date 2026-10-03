import { container } from "../Container.js";
import WeatherRegistry from "../world/weather/WeatherRegistry.js";
import {
  Climate,
  Season,
  WeatherDefinition,
} from "../world/weather/WeatherDefinition.js";

const STATES: WeatherDefinition[] = [
  { id: "weather_clear", labelKey: "weather.clear", icon: "☀", color: "yellow" },
  {
    id: "weather_cloudy",
    labelKey: "weather.cloudy",
    icon: "☁",
    color: "white",
  },
  {
    id: "weather_rain",
    labelKey: "weather.rain",
    icon: "🌧",
    color: "blue",
    perTurn: { happiness: -0.6 },
  },
  {
    id: "weather_storm",
    labelKey: "weather.storm",
    icon: "⛈",
    color: "blue",
    perTurn: { health: -1, happiness: -1 },
  },
  {
    id: "weather_snow",
    labelKey: "weather.snow",
    icon: "❄",
    color: "cyan",
    perTurn: { health: -0.5, happiness: -0.3 },
  },
  {
    id: "weather_fog",
    labelKey: "weather.fog",
    icon: "🌫",
    color: "gray",
    perTurn: { happiness: -0.3 },
  },
  {
    id: "weather_drought",
    labelKey: "weather.drought",
    icon: "🏜",
    color: "yellow",
    perTurn: { health: -0.4, happiness: -0.5 },
  },
  {
    id: "weather_heat",
    labelKey: "weather.heat",
    icon: "🔥",
    color: "red",
    perTurn: { health: -0.5, happiness: -0.6, fitness: -0.3 },
  },
];

const BASE_TRANSITIONS: Record<string, Array<{ to: string; weight: number }>> = {
  weather_clear: [
    { to: "weather_clear", weight: 3 },
    { to: "weather_cloudy", weight: 3 },
    { to: "weather_rain", weight: 1 },
    { to: "weather_fog", weight: 0.5 },
    { to: "weather_drought", weight: 0.5 },
    { to: "weather_heat", weight: 0.5 },
  ],
  weather_cloudy: [
    { to: "weather_clear", weight: 2 },
    { to: "weather_cloudy", weight: 2 },
    { to: "weather_rain", weight: 2 },
    { to: "weather_storm", weight: 0.6 },
    { to: "weather_fog", weight: 1 },
    { to: "weather_snow", weight: 0.6 },
  ],
  weather_rain: [
    { to: "weather_cloudy", weight: 2 },
    { to: "weather_rain", weight: 2 },
    { to: "weather_storm", weight: 1 },
    { to: "weather_clear", weight: 1 },
  ],
  weather_storm: [
    { to: "weather_rain", weight: 2 },
    { to: "weather_cloudy", weight: 2 },
    { to: "weather_clear", weight: 1 },
  ],
  weather_snow: [
    { to: "weather_cloudy", weight: 2 },
    { to: "weather_snow", weight: 1 },
    { to: "weather_clear", weight: 1 },
  ],
  weather_fog: [
    { to: "weather_cloudy", weight: 2 },
    { to: "weather_fog", weight: 1 },
    { to: "weather_clear", weight: 1 },
  ],
  weather_drought: [
    { to: "weather_clear", weight: 2 },
    { to: "weather_heat", weight: 1 },
    { to: "weather_drought", weight: 1 },
    { to: "weather_rain", weight: 0.5 },
  ],
  weather_heat: [
    { to: "weather_clear", weight: 2 },
    { to: "weather_cloudy", weight: 1 },
    { to: "weather_heat", weight: 1 },
    { to: "weather_drought", weight: 1 },
  ],
};

const CLIMATE_MULT: Record<Climate, Record<string, number>> = {
  temperate: {},
  arid: {
    weather_drought: 3,
    weather_heat: 3,
    weather_rain: 0.4,
    weather_snow: 0.1,
    weather_fog: 0.3,
    weather_storm: 0.3,
  },
  polar: {
    weather_snow: 4,
    weather_heat: 0.05,
    weather_drought: 0.1,
    weather_clear: 0.8,
    weather_storm: 0.6,
  },
  coastal: {
    weather_fog: 2,
    weather_rain: 1.6,
    weather_storm: 1.3,
    weather_drought: 0.3,
  },
  highland: {
    weather_snow: 2.5,
    weather_fog: 1.8,
    weather_storm: 1.5,
    weather_heat: 0.4,
    weather_drought: 0.5,
  },
};

const SEASON_MULT: Record<Season, Record<string, number>> = {
  spring: { weather_rain: 1.5, weather_clear: 1.2, weather_snow: 0.3 },
  summer: { weather_heat: 2.2, weather_drought: 1.8, weather_snow: 0.05, weather_clear: 1.2 },
  autumn: { weather_cloudy: 1.3, weather_fog: 1.4, weather_rain: 1.2, weather_storm: 1.2 },
  winter: { weather_snow: 2.4, weather_fog: 1.4, weather_heat: 0.1, weather_clear: 0.9 },
};

export default class Weather {
  private static init = false;

  public static load(): void {
    if (this.init) return;
    this.init = true;
    const reg = container.resolve(WeatherRegistry);
    for (const s of STATES) if (!reg.getState(s.id)) reg.registerState(s);
    for (const [from, to] of Object.entries(BASE_TRANSITIONS)) {
      reg.setBaseTransitions(from, to);
    }
    for (const [climate, mult] of Object.entries(CLIMATE_MULT)) {
      reg.setClimateMultipliers(climate as Climate, mult);
    }
    for (const [season, mult] of Object.entries(SEASON_MULT)) {
      reg.setSeasonMultipliers(season as Season, mult);
    }
  }
}
