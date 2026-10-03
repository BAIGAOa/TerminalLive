import IncidentFilter from "../../event/IncidentFilter.js";
import FilterContext from "../../event/FilterContext.js";

/** Hard gate: an event only fires under one specific weather. */
export interface WeatherGate {
  weather: string;
}

/** Soft bias: multiply an event's weight when the current weather matches. */
export interface WeatherBias {
  weather: string;
  factor: number;
}

/** Event filter: drops incidents whose `weatherGate` doesn't match now. */
export default class WeatherFilter implements IncidentFilter {
  public isEligible(context: FilterContext): boolean {
    const gate = context.incident.weatherGate;
    if (!gate || !context.weather) return true;
    return context.weather.currentIdValue() === gate.weather;
  }
}

export function weatherBiasFactor(
  bias: WeatherBias[] | null | undefined,
  currentId: string | null,
): number {
  if (!bias || !currentId) return 1;
  let factor = 1;
  for (const b of bias) {
    if (b.weather === currentId) factor *= b.factor;
  }
  return factor;
}
