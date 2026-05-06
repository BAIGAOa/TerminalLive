import z from "zod";

export const levelConfigSchema = z.object({
    id: z.string(),
    nameKey: z.string(),
    descriptionKey: z.string(),
    difficultyIdentification: z.string().default('easy'),
    nextLevel: z.string(),
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
