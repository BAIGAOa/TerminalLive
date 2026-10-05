import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inject } from "../../Container.js";
import WeatherRegistry from "./WeatherRegistry.js";
import { Climate, Season } from "./WeatherDefinition.js";

interface WeatherFile {
  states?: unknown[];
  baseTransitions?: Record<string, Array<{ to: string; weight: number }>>;
  climateMult?: Record<string, Record<string, number>>;
  seasonMult?: Record<string, Record<string, number>>;
}

/**
 * Loads a world's weather content from a `weather/weather.json` file into the
 * {@link WeatherRegistry}. The caller clears the registry first when a world is
 * self-contained.
 */
export default class WeatherLoader {
  private registry: WeatherRegistry;

  constructor() {
    this.registry = inject(WeatherRegistry);
  }

  public loadDir(dir: string): void {
    const path = join(dir, "weather.json");
    if (!existsSync(path)) return;
    let data: WeatherFile;
    try {
      data = JSON.parse(readFileSync(path, "utf-8")) as WeatherFile;
    } catch (err) {
      console.error(`[weather] 解析 ${path} 失败:`, (err as Error).message);
      return;
    }
    for (const s of data.states ?? []) this.registry.registerState(s as never);
    for (const [from, to] of Object.entries(data.baseTransitions ?? {})) {
      this.registry.setBaseTransitions(from, to);
    }
    for (const [climate, mult] of Object.entries(data.climateMult ?? {})) {
      this.registry.setClimateMultipliers(climate as Climate, mult);
    }
    for (const [season, mult] of Object.entries(data.seasonMult ?? {})) {
      this.registry.setSeasonMultipliers(season as Season, mult);
    }
  }
}
