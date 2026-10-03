import z from "zod";

/** Broad families the hidden "pressures" are grouped into. */
export type PressureClass =
  | "nature"
  | "society"
  | "economy"
  | "culture"
  | "supernatural"
  | "meta";

export const PRESSURE_CLASSES: PressureClass[] = [
  "nature",
  "society",
  "economy",
  "culture",
  "supernatural",
  "meta",
];

/**
 * A hidden world variable. It sits in a range, drifts back toward its baseline
 * each year, and is pushed by {@link PressureRule}s — together they form a
 * web of feedback loops that quietly colours the whole game.
 */
export interface PressureDefinition {
  id: string;
  labelKey: string;
  descKey?: string;
  class: PressureClass;
  icon?: string;
  min: number;
  max: number;
  /** Starting value for a new life. */
  initial: number;
  /** Value the axis is pulled back toward each turn. */
  baseline: number;
  /** Fraction of the gap to baseline corrected per turn (0..1). */
  drift: number;
}

export const pressureAxisSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string().optional(),
  class: z.enum([
    "nature",
    "society",
    "economy",
    "culture",
    "supernatural",
    "meta",
  ]),
  icon: z.string().optional(),
  min: z.number().default(0),
  max: z.number().default(100),
  initial: z.number().default(50),
  baseline: z.number().default(50),
  drift: z.number().min(0).max(1).default(0.05),
});

export type PressureAxisJson = z.infer<typeof pressureAxisSchema>;
