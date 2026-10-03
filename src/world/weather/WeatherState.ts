import { container } from "../../Container.js";
import WeatherRegistry from "./WeatherRegistry.js";
import {
  Climate,
  seasonOf,
  WeatherDefinition,
} from "./WeatherDefinition.js";
import { StatDelta } from "../stats.js";
import type PressureState from "../pressures/PressureState.js";

export interface WeatherTickResult {
  /** New weather id when it changed this turn. */
  changed?: string;
}

const DEFAULT_WEATHER = "weather_clear";

/**
 * The weather state machine. A container singleton, reset for each new life.
 * The next state is drawn from the current state's transition table, weighted
 * by climate, season, and the hidden-score web (moisture → rain, calamity →
 * storm, cold → snow, …).
 */
export default class WeatherState {
  private registry: WeatherRegistry;
  private currentId = DEFAULT_WEATHER;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor() {
    this.registry = container.resolve(WeatherRegistry);
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): number => this.version;

  private notify(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  public current(): WeatherDefinition | undefined {
    return this.registry.getState(this.currentId);
  }

  public currentIdValue(): string {
    return this.currentId;
  }

  public reset(): void {
    this.currentId = DEFAULT_WEATHER;
    this.notify();
  }

  public set(id: string): void {
    if (this.registry.getState(id)) {
      this.currentId = id;
      this.notify();
    }
  }

  /** Weather's per-year grip on the player. */
  public perTurn(): StatDelta {
    return this.current()?.perTurn ?? {};
  }

  /** How the hidden scores bias each candidate weather's weight. */
  private pressureFactor(weatherId: string, pressures: PressureState | null): number {
    if (!pressures) return 1;
    const v = (id: string, mid = 50) => pressures.get(id) - mid;
    let f = 1;
    switch (weatherId) {
      case "weather_storm":
        f = 1 + v("pr_calamity") / 50;
        break;
      case "weather_rain":
        f = 1 + v("pr_moist") / 50;
        break;
      case "weather_drought":
        f = 1 + (50 - pressures.get("pr_moist")) / 50 + v("pr_temp") / 50;
        break;
      case "weather_snow":
        f = 1 + (50 - pressures.get("pr_temp")) / 50;
        break;
      case "weather_fog":
        f = 1 + v("pr_mystery", 50) / 60;
        break;
      case "weather_heat":
        f = 1 + v("pr_temp") / 50;
        break;
      default:
        f = 1;
    }
    return Math.max(0.05, f);
  }

  /** Advance the weather for `year` in `climate`, modulated by `pressures`. */
  public advance(
    year: number,
    climate: Climate,
    pressures: PressureState | null,
    rand: () => number = Math.random,
  ): WeatherTickResult {
    const season = seasonOf(year);
    const candidates = this.registry.getBase(this.currentId);
    const from = this.currentId;

    let total = 0;
    const weighted = candidates.map((c) => {
      const w = Math.max(
        0,
        c.weight *
          this.registry.multiplier(climate, season, c.to) *
          this.pressureFactor(c.to, pressures),
      );
      total += w;
      return { to: c.to, w };
    });

    let next = from;
    if (total > 0) {
      let r = rand() * total;
      for (const entry of weighted) {
        if (r < entry.w) {
          next = entry.to;
          break;
        }
        r -= entry.w;
      }
    }

    const changed = next !== from ? next : undefined;
    this.currentId = next;
    this.notify();
    return { changed };
  }

  public snapshot(): string {
    return this.currentId;
  }

  public restore(id: string): void {
    if (this.registry.getState(id)) this.currentId = id;
    this.notify();
  }
}
