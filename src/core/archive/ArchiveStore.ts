import { homedir } from "node:os";
import { join, parse } from "node:path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { Scope, Scoped, inject } from "di-wise";
import { SaveData, SaveMeta, saveDataSchema } from "./SaveSchema.js";
import Player from "../../world/Player.js";
import EventHistory from "../../event/EventHistory.js";
import AchievementStore from "../../achievement/AchievementStore.js";
import ConfigStore from "../store/ConfigStore.js";

@Scoped(Scope.Container)
export class ArchiveStore {
  readonly SAVE_DIR: string;

  // Player 是外部可变状态，不归 ArchiveStore 持有，只在保存时通过引用获取最新值
  private playerRef: Player | null = null;
  private eventHistory: EventHistory;
  private achievementStore: AchievementStore;
  private configStore: ConfigStore;

  constructor() {
    this.SAVE_DIR = join(homedir(), ".archive_live");
    // 构造时立即确保目录存在：后续读写操作依赖该目录，提前创建可避免每次操作做检查，
    // 同时把创建失败的问题提前暴露，属于快速失败策略。
    this.ensureDir();
    this.eventHistory = inject(EventHistory);
    this.achievementStore = inject(AchievementStore);
    this.configStore = inject(ConfigStore);
  }

  /**
   * 注入当前 Player 引用。
   * 需要外部调用是因为 Player 实例生命周期由其他模块管理，
   * 且可能在游戏过程中被替换（如新游戏），
   * ArchiveStore 只持有引用，不负责创建和销毁。
   */
  public setPlayer(p: Player): void {
    this.playerRef = p;
  }

  /**
   * 列出所有存档元数据，按时间倒序。
   * 只返回元数据而非完整存档对象：
   * 列表视图只需摘要信息，减少 I/O 和内存占用；
   * 加载时再按需读取完整数据，符合延迟加载原则。
   * 忽略解析失败的文件：
   * 存档文件可能因外部修改、写入中断等损坏，直接跳过比抛出异常更健壮，
   * 避免一个坏文件导致整个列表不可用。
   */
  public listSaves(): SaveMeta[] {
    let files: string[];
    try {
      files = readdirSync(this.SAVE_DIR).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    const result: SaveMeta[] = [];
    for (const file of files) {
      try {
        const raw = readFileSync(join(this.SAVE_DIR, file), "utf-8");
        const data = JSON.parse(raw);
        result.push({
          name: parse(file).name,
          timestamp: data.timestamp ?? "",
          playerName: data.player?.playerName ?? "Unknown",
          age: data.player?.age ?? 0,
        });
      } catch {
        /* 跳过损坏文件 */
      }
    }
    // 按时间戳字符串降序：ISO 8601 格式天然适合字典序比较，无需解析为 Date
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return result;
  }

  /**
   * 保存当前状态为新的存档文件。
   * 文件名为 `yyyy-MM-dd-HH-mm`：
   *  - 保证唯一性（分钟级精度足够）；
   *  - 可读性强，用户和列表展示可直接识别保存时间。
   * 包含 version 字段：
   * 未来修改存档结构时，加载方可根据版本做迁移或拒绝加载，
   * 是实现向后兼容的基础。
   * 将 Set 和 Map 转换为数组/对象再序列化：
   * JSON 不支持 Set/Map 等 ES6 集合类型，必须转换。
   * 使用 Zod schema 验证（saveDataSchema.parse）：
   * 在写入前验证数据结构完整性，避免因运行时错误写出无效存档，
   * 相当于“编译时”检查，把问题拦截在持久化之前。
   */
  public save(): string {
    // 严格检查 playerRef：如果没有玩家状态，存档无意义，提前报错避免写出不完整数据
    if (!this.playerRef) throw new Error("Player 未初始化");

    const now = new Date().toISOString();
    const name = this.formatTimestamp();
    const data: SaveData = {
      version: 1,
      timestamp: now,
      player: {
        playerName: this.playerRef.playerName,
        age: this.playerRef.age,
        health: this.playerRef.health,
        height: this.playerRef.height,
        weight: this.playerRef.weight,
        angerValue: this.playerRef.angerValue,
        excitationValue: this.playerRef.excitationValue,
        depressionValue: this.playerRef.depressionValue,
        weakValue: this.playerRef.weakValue,
        fortune: this.playerRef.fortune,
      },
      history: {
        triggered: Array.from(this.eventHistory.getTriggered()),
        blocked: Array.from(this.eventHistory.getBlocked()),
        rangeRecord: this.serializeRangeRecord(),
      },
      // 只保存已解锁成就：减少存档体积，未解锁内容可由配置或静态数据恢复
      achievements: this.achievementStore
        .getSnapshot()
        .filter((a) => a.unlocked)
        .map((a) => ({ id: a.id, unlockedAt: a.unlockedAt })),
      config: {
        language: this.configStore.getLanguage(),
        enabledMods: this.configStore.getSnapshot().enabledMods ?? [],
      },
    };

    saveDataSchema.parse(data);
    writeFileSync(
      join(this.SAVE_DIR, `${name}.json`),
      JSON.stringify(data, null, 2),
      "utf-8",
    );
    return name;
  }

  /**
   * 加载指定存档，恢复游戏状态。
   * 恢复顺序为 config -> achievements -> history：
   * 配置（如语言、Mod）可能影响后续恢复时使用的本地化文本或事件行为，
   * 先设置环境再恢复数据是合理顺序；成就和事件无依赖顺序，分别恢复即可。
   * 成就恢复后显式调用 persist：
   * 确保从存档恢复的成就数据立刻写入 AchievementStore 的持久化介质，
   * 避免应用崩溃时恢复丢失。
   * 历史事件用 restoreFromArchive 而非直接替换
   * EventHistory 内部可能有未序列化的运行时状态或优化索引，
   * 通过专用方法恢复可以执行合并、清理、重建索引等逻辑。
   */
  public async load(name: string): Promise<void> {
    const raw = readFileSync(join(this.SAVE_DIR, `${name}.json`), "utf-8");
    const data = saveDataSchema.parse(JSON.parse(raw)) as SaveData;

    await this.configStore.update({
      language: data.config.language,
      enabledMods: data.config.enabledMods,
      player: data.player,
    });

    this.achievementStore.saveFromArchive(data.achievements);
    await this.achievementStore.persist();

    this.eventHistory.restoreFromArchive(data.history);
    this.eventHistory.save();
  }

  /**
   * 删除指定存档。
   * 先检查文件存在再删除是为了避免因文件不存在抛出异常，
   * 保持接口幂等性（多次调用效果相同）。
   */
  public delete(name: string): void {
    const path = join(this.SAVE_DIR, `${name}.json`);
    if (existsSync(path)) unlinkSync(path);
  }

  /**
   * 确保存档根目录存在。
   * 使用 recursive: true 是因为如果上层路径（如 ~）因某些原因也不存在（极少见），
   * 可以一并创建，避免深层路径创建失败。
   */
  private ensureDir(): void {
    if (!existsSync(this.SAVE_DIR)) {
      mkdirSync(this.SAVE_DIR, { recursive: true });
    }
  }

  /**
   * 生成可读时间戳字符串，不含冒号等非法文件名字符。
   * 不用 ISO 8601 完整格式是因为完整格式含 `:`，在 Windows 上是非法文件名；
   * 使用连字符分隔保证跨平台兼容，且字典序仍具时间顺序性。
   */
  private formatTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  /**
   * 将事件范围 Map 转为普通对象用于序列化。
   * 不在调用处内联转换是为了职责分离，便于未来修改序列化逻辑（如压缩键名）。
   */
  private serializeRangeRecord(): Record<string, string[]> {
    const record = this.eventHistory.getRangeKeyRecord();
    const result: Record<string, string[]> = {};
    for (const [key, set] of record) {
      result[key] = Array.from(set);
    }
    return result;
  }
}
