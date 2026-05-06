import { inject, Scope, Scoped } from "di-wise";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import Player from "../world/Player.js";
import {
  Achievement,
  AchievementCondition,
  AchievementConfig,
} from "./Achievement.js";
import { container } from "../Container.js";
import { fileURLToPath } from "url";
import LevelManager from "../level/LevelManager.js";
import TypedEventBus from "../core/TypedEventBus.js";

type Listener = () => void;

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

// 成就存储：管理所有成就的定义和运行时状态。
//
// 持久化策略：
//   成就定义（成就叫什么、条件是什么）写在代码里，每次启动重新注册。
//   只有解锁状态（unlocked + unlockedAt）持久化到 unlocked.json。
//   这样新增成就时不需要迁移存档——新成就自动以未解锁状态出现，
//   而修改已有成就不影响已解锁的记录（除非你改了 id）。
//
// 检查时机：
//   不是每帧轮询，而是订阅事件总线——只有事件触发或玩家更新时才跑一次 checkAll。
//   成就的条件检查很轻量（最多几十个成就 × 几个条件），但没必要在无变化时白跑。
@Scoped(Scope.Container)
export default class AchievementStore {
  private achievements: Map<string, Achievement> = new Map();
  private listeners: Set<Listener> = new Set();
  private player: Player | null = null;

  // 缓存快照：getSnapshot 在 React 的 useSyncExternalStore 里会被频繁调用，
  // 每次调用都从 Map 重新生成数组太浪费。加个缓存，数据变更时清掉重新算。
  // 我亲自经历了react在大量重复调用之后直接崩溃退出程序的烦恼
  private cachedSnapshot: Achievement[] | null = null;
  private readonly SAVE_PATH: string = join(
    _dirname,
    "..",
    "..",
    "resource",
    "achievement",
    "unlocked.json",
  );

  private levelManager: LevelManager;

  constructor() {
    const eventBus = container.resolve(TypedEventBus);
    this.levelManager = inject(LevelManager);
    eventBus.on("incident:executed", (_data) => {
      this.checkAll();
    });

    eventBus.on("player:updated", () => {
      this.checkAll();
    });
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = () => {
    if (this.cachedSnapshot === null) {
      this.cachedSnapshot = Array.from(this.achievements.values());
    }
    return this.cachedSnapshot;
  };

  public register(config: AchievementConfig): void {
    this.achievements.set(config.id, new Achievement(config));
    this.cachedSnapshot = null;
  }

  // 任何时候改动了成就数据，都要清缓存并通知 UI 刷新。
  // 统一走这个方法而不是在多个地方分别 notify/listener/清缓存，防止漏掉某一个。
  private emitChange(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((fn) => fn());
  }

  // Player 是外部注入的引用，不归 AchievementStore 创建。
  // 这样 Player 被替换时（比如加载存档），只需要重新 bind 一次新的引用。
  public bindPlayer(player: Player): void {
    this.player = player;
  }

  // 遍历所有成就，检查未解锁的成就是否满足条件。
  // 一次可以解锁多个成就（比如年龄到 10 岁时同时满足"活到 10 岁"和"健康值 > 50"）。
  // 解锁后直接持久化：如果后面 crash 了，已解锁的不会丢。
  private checkAll(): void {
    if (!this.player) return;

    const eventHistory = this.levelManager.getCurrentEventHistory();
    const triggeredEvents = eventHistory
      ? eventHistory.getTriggered()
      : new Set<string>();
    let anyUnlocked = false;

    for (const achievement of this.achievements.values()) {
      if (achievement.unlocked) continue;

      if (this.checkConditions(achievement.conditions, triggeredEvents)) {
        achievement.unlocked = true;
        // 用玩家当前年龄作为解锁时间，而不是真实时间戳。
        // 这样在成就列表里显示"在 15 岁时解锁"，比"解锁于 2026-05-01"更贴合人生模拟的语境。
        achievement.unlockedAt = this.player.age;
        anyUnlocked = true;

        const eventBus = container.resolve(TypedEventBus);
        eventBus.emit("achievement:unlocked", {
          id: achievement.id,
          remindKey: achievement.remindKey,
        });
      }
    }

    // 只在有新解锁时才写磁盘和通知 UI。如果没有任何变化就跳过，
    // 避免每回合都触发无意义的 I/O。
    if (anyUnlocked) {
      this.persist();
      this.emitChange();
    }
  }

  // 所有条件必须同时满足（every），不支持"或"逻辑。
  // 这不是设计缺陷——如果需要"或"，可以在 custom 条件里自己写。
  // 保持基础条件原子化，组合逻辑交给 custom，整体更清晰。
  private checkConditions(
    conditions: AchievementCondition[],
    triggeredEvents: Set<string>,
  ): boolean {
    return conditions.every((cond) =>
      this.checkSingleCondition(cond, triggeredEvents),
    );
  }

  private checkSingleCondition(
    cond: AchievementCondition,
    triggeredEvents: Set<string>,
  ): boolean {
    switch (cond.type) {
      case "incidentTriggered":
        return triggeredEvents.has(cond.incidentId);

      case "statThreshold": {
        if (!this.player) return false;
        const val = this.player[cond.stat] as number;
        return cond.comparator === "gte"
          ? val >= cond.value
          : val <= cond.value;
      }

      case "custom":
        return cond.check(this.player!, triggeredEvents);

      default:
        return false;
    }
  }

  // 持久化只写已解锁的成就。文件名固定为 unlocked.json，不附带时间戳。
  // 这不是存档——存档在 ArchiveStore 里。这个文件只是「当前进度」的持久化，
  // 每次启动自动加载，跟存档系统是独立的。
  public async persist(): Promise<void> {
    const unlocked = Array.from(this.achievements.values())
      .filter((a) => a.unlocked)
      .map((a) => ({ id: a.id, unlockedAt: a.unlockedAt }));

    await writeFile(this.SAVE_PATH, JSON.stringify(unlocked, null, 2), "utf-8");
  }

  // 启动时加载持久化的解锁记录，跟代码注册的成就定义做匹配。
  // 如果 unlocked.json 里有一条记录但代码里没有对应成就了（成就被删了），
  // 直接忽略——不会因为删了一个成就定义就让整个加载崩掉。
  public async load(): Promise<void> {
    try {
      const content = await readFile(this.SAVE_PATH, "utf-8");
      const records: Array<{ id: string; unlockedAt: number | null }> =
        JSON.parse(content);
      for (const record of records) {
        const achievement = this.achievements.get(record.id);
        if (achievement) {
          achievement.unlocked = true;
          achievement.unlockedAt = record.unlockedAt;
        }
      }
    } catch {
      // 文件不存在或损坏都静默处理——第一次启动没有 unlocked.json 很正常
      return;
    }
    this.emitChange();
  }

  public getUnlockedCount(): number {
    let count = 0;
    for (const a of this.achievements.values()) {
      if (a.unlocked) count++;
    }
    return count;
  }

  public getTotalCount(): number {
    return this.achievements.size;
  }

  // 重置所有成就：新游戏或测试时用。
  // 注意这个方法不会自动 persist——调用方决定要不要把清空的状态写回磁盘。
  public reset(): void {
    for (const a of this.achievements.values()) {
      a.unlocked = false;
      a.unlockedAt = null;
    }
    this.emitChange();
  }

  // 从存档恢复成就：和 load 的区别在于 load 从 unlocked.json 读，
  // 这个方法直接从 ArchiveStore 传过来的数组恢复，不碰磁盘。
  // 存档加载的恢复顺序是 配置 → 成就 → 事件，先恢复成就再 persist
  // 是为了确保 unlocked.json 和存档数据对齐。
  public saveFromArchive(
    unlocked: Array<{ id: string; unlockedAt: number | null }>,
  ): void {
    for (const { id, unlockedAt } of unlocked) {
      const achievement = this.achievements.get(id);
      if (achievement) {
        achievement.unlocked = true;
        achievement.unlockedAt = unlockedAt;
      }
    }
  }
}
