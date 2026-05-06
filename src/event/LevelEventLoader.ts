import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import EventCenter from "./EventCenter.js";
import EventTypeRegistry from "../core/mod/EventTypeRegistry.js";
import { IncidentParameter } from "../world/Incident.js";
import { modEventSchema, ModEventDef } from "../types/EventJsonType.js";

/**
 * 关卡事件加载器。
 * 每个关卡拥有自己的实例，绑定到自己的 EventCenter。
 */
export class LevelEventLoader {
    constructor(
        private eventCenter: EventCenter,
        private typeRegistry: EventTypeRegistry,
    ) {}

    /** 加载目录下所有 .json 事件文件 */
    public loadDir(dir: string): void {
        let files: string[];
        try {
            files = readdirSync(dir).filter((f) => extname(f) === ".json");
        } catch {
            console.warn(`目录 ${dir} 不存在或无法读取，跳过事件加载`);
            return;
        }
        for (const file of files) {
            this.loadFile(join(dir, file));
        }
    }

    /** 加载单个 JSON 文件 */
    public loadFile(filePath: string): void {
        let raw: unknown;
        try {
            raw = JSON.parse(readFileSync(filePath, "utf-8"));
        } catch (err) {
            console.error(`解析事件文件 ${filePath} 失败:`, (err as Error).message);
            return;
        }
        const parsed = modEventSchema.safeParse(raw);
        if (!parsed.success) {
            console.error(
                `校验事件文件 ${filePath} 失败:`,
                parsed.error.issues.map((i: { message: string }) => i.message).join(", "),
            );
            return;
        }
        this.registerEvent(parsed.data);
    }

    /** 直接注册已解析的事件定义 */
    public registerEvent(def: ModEventDef): void {
        if (!this.typeRegistry.has(def.type)) {
            console.warn(`跳过事件 "${def.id}": 未知类型 "${def.type}"`);
            return;
        }
        const params: IncidentParameter = {
            id: def.id,
            nameKey: def.nameKey,
            rangeKey: def.rangeKey,
            weight: def.weight,
            predecessorEvent: def.predecessorEvent ?? undefined,
            excludedIds: def.excludedIds,
            once: def.once,
            postEvent: def.postEvent ?? undefined,
            params: def.params,
        };
        try {
            const incident = this.typeRegistry.create(def.type, params);
            for (const range of def.rangeKey) {
                this.eventCenter.add(range, incident);
            }
        } catch (err) {
            console.error(
                `创建事件 "${def.id}" (${def.type}) 失败:`,
                (err as Error).message,
            );
        }
    }
}