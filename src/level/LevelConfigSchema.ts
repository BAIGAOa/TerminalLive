import z from "zod";
import { statDeltaSchema, karmaDeltaSchema } from "../world/schema.js";

export const levelConfigSchema = z.object({
    id: z.string(),
    nameKey: z.string(),
    descriptionKey: z.string(),
    difficultyIdentification: z.string().default('easy'),
    /** Optional act/chapter label for grouping. */
    act: z.string().optional(),
    nextLevel: z.string(),
    /** Optional branching successors; the first with met `requires` wins. */
    nextLevels: z.array(z.object({
        levelId: z.string(),
        requires: z.array(z.object({
            type: z.string(),
            params: z.record(z.string(), z.any()),
        })).default([]),
    })).optional(),
    /** Extra goals beyond the pass conditions; optional ones are medals. */
    objectives: z.array(z.object({
        id: z.string(),
        labelKey: z.string(),
        optional: z.boolean().default(false),
        condition: z.object({
            type: z.string(),
            params: z.record(z.string(), z.any()),
        }),
        reward: z.object({
            effects: statDeltaSchema.optional(),
            items: z.array(z.string()).default([]),
            flag: z.string().optional(),
            karma: karmaDeltaSchema.optional(),
        }).optional(),
    })).default([]),
    algorithm: z.string().default("default"),
    extraFilters: z.array(z.string()).default([]),
    onEnter: z.object({
        setPlayer: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
    nextLevelUnlock: z.array(z.object({
        type: z.string(),
        //先不限制参数里面要填什么，后续通过LevelLoader进行强验证
        // 这可以让模组拥有极其强大的自由度
        params: z.record(z.string(), z.any())
    })).default([])
});

export type LevelJsonConfig = z.infer<typeof levelConfigSchema>;
