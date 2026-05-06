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

// 从磁盘加载 JSON 事件定义，把它们变成真正的 Incident 实例并注册到 EventCenter。
// JSON 里的 type 字段决定用哪个事件类，ModLoader 自己不管事件逻辑，
// 只管把数据和类拼在一起。模组的 events/ 目录也是走 loadFromDir 这条路径。
@Scoped(Scope.Container)
export default class ModLoader {
  private registry: EventTypeRegistry;
  private eventCenter: EventCenter;

  constructor() {
    this.registry = inject(EventTypeRegistry);
    this.eventCenter = inject(EventCenter);
  }

  // 内置事件目录和模组事件目录是分开的，但加载逻辑完全一样。
  // 目录不存在时默默跳过——不是每个模组都有事件，也可能是用户目录里乱放的东西。
  private get eventsDir(): string {
    return join(_dirname, "..", "..", "..", "resource", "events");
  }

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

  private loadFile(filePath: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`解析 ${filePath} 失败:`, (err as Error).message);
      return;
    }

    // Zod 校验是安全网模组作者可能手滑写错字段，用户也可能手动改 JSON。
    // 与其运行时崩在莫名其妙的角落，不如加载时就明明白白报错。
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

  // JSON 里每个 rangeKey 对应一个年龄段，事件要注册到 EventCenter 的每个相关区间。
  // 这样 EventAlgorithm 在查找当前年龄该触发哪些事件时能一口气全捞出来。
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
      // Zod schema 里 postEvent 是 nullable 的（.nullable().default(null)），
      // 所以 def.postEvent 的类型是 string | PostIncidentConfig[] | null。
      // 但 IncidentParameter 接口只接受 string | PostIncidentConfig[] | undefined，
      // 不接受 null——TypeScript 会直接报类型不匹配。
      //
      // 用 ?? 把 null 转成 undefined，不只是消掉类型错误：
      //   - undefined 表示"没指定，用默认值"，null 表示"明确设为空"，
      //     两者语义不同。这里应该传递"未指定"的意图，让 Incident.setup 里
      //     parameter.postEvent ?? this.postEvent 自然回退到基类默认值 null。
      //   - 如果 JSON 里压根没写 postEvent 字段，Zod 的 .default(null) 也会
      //     填成 null，同样需要转 undefined 才能走默认值路径。
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