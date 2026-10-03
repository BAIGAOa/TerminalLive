import z from "zod";
import { StatDelta } from "../stats.js";
import { buffRefSchema, statDeltaSchema } from "../schema.js";

/** A starting trait the player picks before a life begins. */
export interface TraitDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  icon?: string;
  /** Applied once at the start of a life. */
  start?: StatDelta;
  /** Timed effect granted at the start of a life. */
  buff?: { id: string; turns?: number };
}

export const traitSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  icon: z.string().optional(),
  start: statDeltaSchema.optional(),
  buff: buffRefSchema.optional(),
});
