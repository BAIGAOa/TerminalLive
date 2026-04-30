import z from 'zod'
import { Scenes } from './Scenes.js'

//json配置的键盘映射格式


export const keysConfigScheme = z.object({
    keys: z.array(z.object({
        keyName: z.string(),
        operate: z.string(),
        category: z.nativeEnum(Scenes).or(z.array(z.nativeEnum(Scenes)))
    }))
})



export type KeysConfig = z.infer<typeof keysConfigScheme>

