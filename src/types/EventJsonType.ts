import z from "zod";
import { choiceSchema } from "../world/choices.js";

const postEventItemSchema = z.object({
  incident: z.string(),
  delay: z.number().optional(),
  weight: z.number().optional(),
});

const worldGateSchema = z.object({
  era: z.string().optional(),
  region: z.string().optional(),
  faction: z.string().optional(),
  minStanding: z.number().optional(),
});

const pressureGateSchema = z.object({
  axis: z.string(),
  gte: z.number().optional(),
  lte: z.number().optional(),
});

const pressureBiasSchema = z.object({
  axis: z.string(),
  factor: z.number(),
  gte: z.number().optional(),
  lte: z.number().optional(),
});

const weatherGateSchema = z.object({ weather: z.string() });

const weatherBiasSchema = z.object({
  weather: z.string(),
  factor: z.number(),
});


export const modEventSchema = z.object({
  type: z.string(),
  id: z.string(),
  nameKey: z.string().optional(),
  textKey: z.string().optional(),
  choices: z.array(choiceSchema).optional(),
  worldGate: worldGateSchema.optional(),
  pressureGate: pressureGateSchema.optional(),
  pressureBias: z.array(pressureBiasSchema).optional(),
  weatherGate: weatherGateSchema.optional(),
  weatherBias: z.array(weatherBiasSchema).optional(),
  rangeKey: z.array(z.string()).default(["0-100"]),
  weight: z.number().default(0.5),
  predecessorEvent: z.string().nullable().default(null),
  excludedIds: z.array(z.string()).default([]),
  once: z.union([z.boolean(), z.array(z.string())]).default(false),
  postEvent: z
    .union([z.string(), z.array(postEventItemSchema)])
    .nullable()
    .default(null),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type ModEventDef = z.infer<typeof modEventSchema>;