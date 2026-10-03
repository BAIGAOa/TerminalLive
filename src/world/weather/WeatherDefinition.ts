import { StatDelta } from "../stats.js";

/** Broad climate families a region can belong to. */
export type Climate = "temperate" | "arid" | "polar" | "coastal" | "highland";

export const CLIMATES: Climate[] = [
  "temperate",
  "arid",
  "polar",
  "coastal",
  "highland",
];

export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** One weather state; `perTurn` is the grip it has on the player each year. */
export interface WeatherDefinition {
  id: string;
  labelKey: string;
  icon?: string;
  color?: string;
  perTurn?: StatDelta;
}

/** A weighted edge in the weather state machine. */
export interface WeatherTransition {
  to: string;
  weight: number;
}

export function seasonOf(year: number): Season {
  return SEASONS[((year % 4) + 4) % 4];
}
