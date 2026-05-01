import z from "zod";

//json配置的键盘映射格式

export const keysConfigScheme = z.object({
  keys: z.array(
    z.object({
      keyName: z.string(),
      operate: z.string(),
      category: z.string().or(z.array(z.string())),
    }),
  ),
});

export type KeysConfig = z.infer<typeof keysConfigScheme>;
