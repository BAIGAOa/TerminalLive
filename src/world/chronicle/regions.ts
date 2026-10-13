import { KarmaDelta } from "./karma.js";
import { Climate } from "../weather/WeatherDefinition.js";

/** A place the player is born into; colours the life with a starting tone. */
export interface RegionDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  /**
   * Translation key for the region's line in the narrator's scene paragraph.
   * Optional for the same reason as {@link EraDefinition.narrKey}: region ids
   * are world-scoped, so only the world knows what to call them.
   */
  narrKey?: string;
  icon?: string;
  /** Faction the region leans toward (starting standing bonus). */
  favorFaction?: string;
  /** Karma the region instils at birth. */
  startKarma?: KarmaDelta;
  /** Climate band that shapes the region's weather. */
  climate?: Climate;
  /** Adjacent region ids (the world's textual "map"). */
  neighbors?: string[];
}
