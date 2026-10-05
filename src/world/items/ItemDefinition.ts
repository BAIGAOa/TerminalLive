import z from "zod";
import { StatDelta } from "../stats.js";
import { buffRefSchema, statDeltaSchema } from "../schema.js";

export interface ItemDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  icon?: string;
  /** Whether the player can use it from the inventory. */
  usable?: boolean;
  /** Consumed (removed) on use. */
  consumable?: boolean;
  /** Stat change applied on use. */
  effects?: StatDelta;
  /** Timed effect granted on use. */
  buff?: { id: string; turns?: number };
  tags?: string[];
  /** Purchase price in the shop (items without a price are not sold). */
  price?: number;
}

export const itemSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  icon: z.string().optional(),
  usable: z.boolean().default(false),
  consumable: z.boolean().default(true),
  effects: statDeltaSchema.optional(),
  buff: buffRefSchema.optional(),
  tags: z.array(z.string()).default([]),
  price: z.number().min(0).optional(),
});

export type ItemJson = z.infer<typeof itemSchema>;
