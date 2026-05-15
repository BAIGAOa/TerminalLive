import { inject, Scope, Scoped } from "di-wise";
import AchievementRegistry from "../core/registry/AchievementRegistry.js";
import AchievementPersistence from "./AchievementPersistence.js";
import TypedEventBus from "../core/TypedEventBus.js";
import LevelManager from "../level/LevelManager.js";
import Player from "../world/Player.js";
import { Achievement } from "./AchievementDefinition.js";

type Listener = () => void;

export interface MergedAchievement extends Achievement {
  unlocked: boolean;
  unlockedAt: number | null;
}

@Scoped(Scope.Container)
export default class AchievementManager {
  private registry: AchievementRegistry;
  private persistence: AchievementPersistence;
  private eventBus: TypedEventBus;
  private levelManager: LevelManager;

  private states = new Map<string, { unlocked: boolean; unlockedAt: number | null }>();
  private listeners = new Set<Listener>();
  private cachedSnapshot: MergedAchievement[] | null = null;
  private player: Player | null = null;

  constructor() {
    this.registry = inject(AchievementRegistry);
    this.persistence = inject(AchievementPersistence);
    this.eventBus = inject(TypedEventBus);
    this.levelManager = inject(LevelManager);

    this.eventBus.on("incident:executed", () => this.checkAll());
    this.eventBus.on("player:updated", () => this.checkAll());
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): MergedAchievement[] => {
    if (this.cachedSnapshot === null) {
      this.cachedSnapshot = this.registry.getAllAchievements().map((def) => {
        const state = this.states.get(def.id);
        return {
          ...def,
          unlocked: state?.unlocked ?? false,
          unlockedAt: state?.unlockedAt ?? null,
        };
      });
    }
    return this.cachedSnapshot;
  };

  public bindPlayer(player: Player): void {
    this.player = player;
  }

  public async load(): Promise<void> {
    const records = await this.persistence.load();
    for (const { id, unlockedAt } of records) {
      this.states.set(id, { unlocked: true, unlockedAt });
    }
    this.emitChange();
  }

  public async persist(): Promise<void> {
    const data = Array.from(this.states.entries())
      .filter(([, s]) => s.unlocked)
      .map(([id, s]) => ({ id, unlockedAt: s.unlockedAt }));
    await this.persistence.save(data);
  }

  /** 存档系统：序列化 */
  public getState() {
    return Array.from(this.states.entries()).map(([id, s]) => ({
      id,
      unlockedAt: s.unlockedAt,
    }));
  }

  /** 存档系统：反序列化 */
  public setState(data: Array<{ id: string; unlockedAt: number | null }>): void {
    this.states.clear();
    for (const { id, unlockedAt } of data) {
      this.states.set(id, { unlocked: true, unlockedAt });
    }
    this.emitChange();
  }

  public reset(): void {
    this.states.clear();
    this.emitChange();
  }

  

  private checkAll(): void {
    if (!this.player) return;

    const eventHistory = this.levelManager.getCurrentEventHistory();
    const triggeredEvents = eventHistory
      ? eventHistory.getTriggered()
      : new Set<string>();

    let anyUnlocked = false;

    for (const ach of this.registry.getAllAchievements()) {
      const state = this.states.get(ach.id);
      if (state?.unlocked) continue;

      if (this.checkConditions(ach, triggeredEvents)) {
        this.states.set(ach.id, { unlocked: true, unlockedAt: this.player.age });
        anyUnlocked = true;

        this.eventBus.emit("achievement:unlocked", {
          id: ach.id,
          remindKey: ach.descriptionKey, // 用 descriptionKey 替代 remindKey
        });
      }
    }

    if (anyUnlocked) {
      this.persist();
      this.emitChange();
    }
  }

  private checkConditions(
    ach: Achievement,
    triggeredEvents: Set<string>,
  ): boolean {
    if (ach.conditions.length === 0) return false;

    // orCondition 逻辑：任一满足 / 全部满足
    if (ach.orCondition) {
      return ach.conditions.some((cond) =>
        this.checkSingle(cond, triggeredEvents),
      );
    }
    return ach.conditions.every((cond) =>
      this.checkSingle(cond, triggeredEvents),
    );
  }

  private checkSingle(
    cond: Achievement["conditions"][number],
    triggeredEvents: Set<string>,
  ): boolean {
    switch (cond.type) {
      case "incident":
        return triggeredEvents.has(cond.incidentId);
      default:
        return false;
    }
  }

  private emitChange(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((fn) => fn());
  }
}