import z from "zod";

const postEventItemSchema = z.object({
  incident: z.string(),
  delay: z.number().optional(),
  weight: z.number().optional(),
});


export const modEventSchema = z.object({
  type: z.string(),
  id: z.string(),
  nameKey: z.string().optional(),
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