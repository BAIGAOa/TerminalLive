import { Scope, Scoped } from "di-wise";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import Player from "../world/Player.js";
import EventBus from "../core/EventBus.js";
import EventHistory from "../event/EventHistory.js";
import {
  Achievement,
  AchievementCondition,
  AchievementConfig,
} from "./Achievement.js";
import { container } from "../Container.js";
import { fileURLToPath } from "url";

type Listener = () => void;

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

@Scoped(Scope.Container)
export default class AchievementStore {
  private achievements: Map<string, Achievement> = new Map();
  private listeners: Set<Listener> = new Set();
  private player: Player | null = null;

  private cachedSnapshot: Achievement[] | null = null;
  private readonly SAVE_PATH: string = join(
    _dirname,
    "..",
    "..",
    "resource",
    "achievement",
    "unlocked.json",
  );

  constructor() {
    const eventBus = container.resolve(EventBus);
    eventBus.on("incident:executed", (_data: { incidentId: string }) => {
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

  /** 注册成就定义 */
  public register(config: AchievementConfig): void {
    this.achievements.set(config.id, new Achievement(config));
    this.cachedSnapshot = null;
  }

  private emitChange(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((fn) => fn());
  }

  /** 绑定玩家实例 */
  public bindPlayer(player: Player): void {
    this.player = player;
  }

  private checkAll(): void {
    if (!this.player) return;

    const triggeredEvents = container.resolve(EventHistory).getTriggered();
    let anyUnlocked = false;

    for (const achievement of this.achievements.values()) {
      if (achievement.unlocked) continue;

      if (this.checkConditions(achievement.conditions, triggeredEvents)) {
        achievement.unlocked = true;
        achievement.unlockedAt = this.player.age;
        anyUnlocked = true;

        // 通知成就解锁
        const eventBus = container.resolve(EventBus);
        eventBus.emit("achievement:unlocked", {
          id: achievement.id,
          remindKey: achievement.remindKey,
        });
      }
    }

    if (anyUnlocked) {
      this.persist();
      this.emitChange();
    }
  }

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

  public async persist(): Promise<void> {
    const unlocked = Array.from(this.achievements.values())
      .filter((a) => a.unlocked)
      .map((a) => ({ id: a.id, unlockedAt: a.unlockedAt }));

    await writeFile(this.SAVE_PATH, JSON.stringify(unlocked, null, 2), "utf-8");
  }

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

  public reset(): void {
    for (const a of this.achievements.values()) {
      a.unlocked = false;
      a.unlockedAt = null;
    }
    this.emitChange();
  }

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
