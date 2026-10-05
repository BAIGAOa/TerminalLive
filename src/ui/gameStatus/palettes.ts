import type { KarmaAxis } from "../../world/chronicle/karma.js";

/** Small presentation maps shared by the status views (React-free). */

/** Karma axis → color. */
export const AXIS_COLOR: Record<KarmaAxis, string> = {
  benevolence: "green",
  ambition: "yellow",
  wisdom: "cyan",
  rebellion: "magenta",
};

/** Pressure class → color (falls back to white for unknown classes). */
export const CLASS_COLOR: Record<string, string> = {
  nature: "green",
  society: "yellow",
  economy: "cyan",
  culture: "magenta",
  supernatural: "blue",
  meta: "whiteBright",
};
