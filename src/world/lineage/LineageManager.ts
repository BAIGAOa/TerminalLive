import { container, inject } from "../../Container.js";
import LineageStore from "../../core/store/LineageStore.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import AchievementManager from "../../achievement/AchievementManager.js";
import WorldState from "../chronicle/WorldState.js";
import Player from "../Player.js";
import {
  computeInheritance,
  buildLineageRecord,
  InheritancePlan,
} from "./inheritance.js";

/**
 * Captures a record when a life ends and exposes the plan for the next one.
 *
 * Reads live singletons only (never `life.json`), so it is unaffected by the
 * AutoSave listener that clears the life slot on the same `game:over` event.
 * `AchievementManager` is resolved lazily inside `capture` (not injected in the
 * constructor) to avoid a `WorldManager → LineageManager → AchievementManager →
 * WorldManager` construction cycle.
 */
export default class LineageManager {
  private store: LineageStore;
  private world: WorldState;
  private player: Player | null = null;

  constructor() {
    this.store = inject(LineageStore);
    this.world = inject(WorldState);
    inject(TypedEventBus).on("game:over", ({ reason }) => this.capture(reason));
  }

  public bindPlayer(player: Player): void {
    this.player = player;
  }

  /** What the next life will inherit; null when there is no ancestor. */
  public planForNextLife(): InheritancePlan | null {
    return computeInheritance(this.store.getLast());
  }

  private capture(reason: "death" | "complete"): void {
    if (!this.player) return;
    const achievements = container
      .resolve(AchievementManager)
      .getSnapshot()
      .filter((a) => a.unlocked).length;
    const record = buildLineageRecord({
      player: this.player,
      karma: this.world.karma,
      reason,
      achievements,
      generation: this.store.getNextGeneration(),
    });
    void this.store.recordLife(record);
  }
}
