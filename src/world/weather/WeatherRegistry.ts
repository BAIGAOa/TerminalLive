import {
  Climate,
  Season,
  WeatherDefinition,
  WeatherTransition,
} from "./WeatherDefinition.js";

/** A serialisable snapshot of all weather content. */
export interface WeatherSnapshot {
  states: Array<[string, WeatherDefinition]>;
  base: Array<[string, WeatherTransition[]]>;
  climateMult: Array<[Climate, Record<string, number>]>;
  seasonMult: Array<[Season, Record<string, number>]>;
}

/**
 * Holds the weather states and the transition tables. A single base table is
 * scaled per climate and per season.
 */
export default class WeatherRegistry {
  private states = new Map<string, WeatherDefinition>();
  private base = new Map<string, WeatherTransition[]>();
  private climateMult = new Map<Climate, Record<string, number>>();
  private seasonMult = new Map<Season, Record<string, number>>();

  public registerState(def: WeatherDefinition): void {
    if (this.states.has(def.id)) throw new Error(`天气 ID 重复: ${def.id}`);
    this.states.set(def.id, def);
  }

  public setBaseTransitions(from: string, to: WeatherTransition[]): void {
    this.base.set(from, to);
  }

  public setClimateMultipliers(
    climate: Climate,
    mult: Record<string, number>,
  ): void {
    this.climateMult.set(climate, mult);
  }

  public setSeasonMultipliers(season: Season, mult: Record<string, number>): void {
    this.seasonMult.set(season, mult);
  }

  public getState(id: string): WeatherDefinition | undefined {
    return this.states.get(id);
  }

  public getStates(): WeatherDefinition[] {
    return [...this.states.values()];
  }

  public getBase(from: string): WeatherTransition[] {
    return this.base.get(from) ?? [];
  }

  /** Combined climate × season weight multiplier for a weather state. */
  public multiplier(
    climate: Climate,
    season: Season,
    weatherId: string,
  ): number {
    const c = this.climateMult.get(climate)?.[weatherId] ?? 1;
    const s = this.seasonMult.get(season)?.[weatherId] ?? 1;
    return c * s;
  }

  // ── resettable (World content layering) ────────────────────────
  public snapshot(): WeatherSnapshot {
    return {
      states: [...this.states.entries()],
      base: [...this.base.entries()],
      climateMult: [...this.climateMult.entries()],
      seasonMult: [...this.seasonMult.entries()],
    };
  }

  public restore(snap: WeatherSnapshot): void {
    this.states = new Map(snap.states);
    this.base = new Map(snap.base);
    this.climateMult = new Map(snap.climateMult);
    this.seasonMult = new Map(snap.seasonMult);
  }

  public clear(): void {
    this.states = new Map();
    this.base = new Map();
    this.climateMult = new Map();
    this.seasonMult = new Map();
  }
}
