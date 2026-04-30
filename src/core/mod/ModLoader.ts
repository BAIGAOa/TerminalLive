import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Scope, Scoped, inject } from "di-wise";
import EventTypeRegistry from "./EventTypeRegistry.js";
import EventCenter from "../../event/EventCenter.js";
import { IncidentParameter } from "../../world/Incident.js";
import { ModEventDef, modEventSchema } from "../../types/EventJsonType.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

@Scoped(Scope.Container)
export default class ModLoader {
  private registry: EventTypeRegistry;
  private eventCenter: EventCenter;

  constructor() {
    this.registry = inject(EventTypeRegistry);
    this.eventCenter = inject(EventCenter);
  }

  private get eventsDir(): string {
    return join(_dirname, "..", "..", "..", "resource", "events");
  }

  //加载所有 JSON 文件
  public load(): void {
    this.loadFromDir(this.eventsDir);
  }

  public loadFromDir(dir: string): void {
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => extname(f) === ".json");
    } catch {
      console.warn(`目录 ${dir} 不存在或无法读取，跳过加载`);
      return;
    }

    for (const file of files) {
      this.loadFile(join(dir, file));
    }
  }

  //加载单个事件文件
  private loadFile(filePath: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`解析 ${filePath} 失败:`, (err as Error).message);
      return;
    }

    const parsed = modEventSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `校验 ${filePath} 失败:`,
        parsed.error.issues
          .map((i: { message: string }) => i.message)
          .join(", "),
      );
      return;
    }

    this.createAndRegister(parsed.data);
  }

  //创建事件实例并注册到 EventCenter
  private createAndRegister(def: ModEventDef): void {
    if (!this.registry.has(def.type)) {
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
      const incident = this.registry.create(def.type, params);
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
