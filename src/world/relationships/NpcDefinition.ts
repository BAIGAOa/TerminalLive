import z from "zod";

export interface NpcDefinition {
  id: string;
  labelKey: string;
  descKey: string;
  /** e.g. family / friend / rival — drives the default affinity. */
  roleKey?: string;
  /** Affinity the player starts with (0–100). */
  initial?: number;
}

export const npcSchema = z.object({
  id: z.string(),
  labelKey: z.string(),
  descKey: z.string(),
  roleKey: z.string().optional(),
  initial: z.number().min(0).max(100).default(30),
});

export type NpcJson = z.infer<typeof npcSchema>;
