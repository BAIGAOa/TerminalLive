import { inject } from "../Container.js";
import Player from "../world/Player.js";
import LevelManager from "../level/LevelManager.js";
import ActionRegistry from "../game/actions/ActionRegistry.js";
import { ActionDefinition } from "../game/actions/ActionDefinition.js";
import { meetsRequirements } from "../world/requirements.js";
import { applyEffectPayload } from "../world/effects/applyEffects.js";
import TypedEventBus from "./TypedEventBus.js";
import { PendingChoice } from "../event/PendingChoice.js";
import WorldState from "../world/chronicle/WorldState.js";
import WorldRegistry from "../world/chronicle/WorldRegistry.js";
import PressureState from "../world/pressures/PressureState.js";
import WeatherState from "../world/weather/WeatherState.js";

export type ActionUnavailableReason = "ap" | "age" | "require" | "once";

export interface ActionView {
  def: ActionDefinition;
  available: boolean;
  reason?: ActionUnavailableReason;
}

export type GameStatusKind = "playing" | "dead" | "cleared";

/**
 * The gameplay facade: action-point turns, choice resolution, and life status.
 */
export default class Game {
  private levelManager: LevelManager;
  private actions: ActionRegistry;
  private eventBus: TypedEventBus;
  private world: WorldState;
  private worldRegistry: WorldRegistry;
  private pressures: PressureState;
  private weather: WeatherState;

  constructor() {
    this.levelManager = inject(LevelManager);
    this.actions = inject(ActionRegistry);
    this.eventBus = inject(TypedEventBus);
    this.world = inject(WorldState);
    this.worldRegistry = inject(WorldRegistry);
    this.pressures = inject(PressureState);
    this.weather = inject(WeatherState);
  }

  public get player(): Player {
    return this.levelManager.currentPlayer;
  }

  public init(player: Player): void {
    this.levelManager.setPlayer(player);
  }

  /** @deprecated use endTurn() */
  public update(): void {
    this.endTurn();
  }

  // ── actions ────────────────────────────────────────────────────
  /** Actions available at the player's current age, with availability. */
  public getActionViews(): ActionView[] {
    const p = this.player;
    return this.actions
      .getAll()
      .filter(
        (def) =>
          (def.minAge === undefined || p.age >= def.minAge) &&
          (def.maxAge === undefined || p.age <= def.maxAge),
      )
      .map((def) => ({
        def,
        available: this.isActionAvailable(def),
        reason: this.availabilityReason(def),
      }));
  }

  private availabilityReason(
    def: ActionDefinition,
  ): ActionUnavailableReason | undefined {
    const p = this.player;
    if (def.once && def.flag && p.hasFlag(def.flag)) return "once";
    if (!meetsRequirements(p, def.requires)) return "require";
    if (p.actionPoints < def.apCost) return "ap";
    return undefined;
  }

  public isActionAvailable(def: ActionDefinition): boolean {
    return this.availabilityReason(def) === undefined;
  }

  public performAction(actionId: string): boolean {
    const def = this.actions.get(actionId);
    if (!def || !this.isActionAvailable(def)) return false;

    const p = this.player;
    p.actionPoints -= def.apCost;
    applyEffectPayload(
      p,
      {
        effects: def.effects,
        items: def.items,
        relationship: def.relationship,
        buff: def.buff,
        flag: def.flag,
        karma: def.karma,
        faction: def.faction,
      },
      this.world,
    );
    p.notify();
    this.eventBus.emit("action:performed", { actionId });
    this.eventBus.emit("player:updated");
    return true;
  }

  // ── turn ───────────────────────────────────────────────────────
  public endTurn(): void {
    this.levelManager.update();
    this.advanceWorld();
    this.eventBus.emit("turn:ended", { age: this.player.age });
  }

  /** Advance the chronicle + hidden-score web a year; surface changes as toasts. */
  private advanceWorld(): void {
    // The pressure web rolls first so this year's weather + events read fresh state.
    this.pressures.tick(Math.random, 0.4);

    // Weather: drawn from the current state, biased by climate/season/pressures.
    const weather = this.weather.advance(
      this.player.age,
      this.world.climate(),
      this.pressures,
    );
    if (weather.changed) {
      const def = this.weather.current();
      if (def) {
        this.eventBus.emit("toast", { textKey: def.labelKey, kind: "info" });
      }
    }
    // The weather has a grip on the player each year.
    const grip = this.weather.perTurn();
    if (Object.keys(grip).length > 0) this.player.applyDelta(grip);

    const tick = this.world.tick(this.player.age, this.player.flags);
    if (tick.eraChanged) {
      const era = this.worldRegistry
        .getEras()
        .find((e) => e.id === tick.eraChanged);
      if (era) {
        this.eventBus.emit("toast", { textKey: era.labelKey, kind: "info" });
      }
    }
    for (const id of tick.newLore) {
      const lore = this.worldRegistry.getLore().find((l) => l.id === id);
      if (lore) {
        this.eventBus.emit("toast", { textKey: lore.titleKey, kind: "info" });
      }
    }
    for (const id of tick.newFates) {
      const fate = this.worldRegistry.getFates().find((f) => f.id === id);
      if (!fate) continue;
      this.eventBus.emit("toast", { textKey: fate.labelKey, kind: "success" });
      if (fate.buff) this.player.addEffect(fate.buff.id, fate.buff.turns);
    }

    // Scripted world events: announce and apply their knock-on effects.
    for (const id of tick.worldEvents) {
      const def = this.worldRegistry.getWorldEvent(id);
      if (!def) continue;
      this.eventBus.emit("toast", { textKey: def.labelKey, kind: "warn" });
      if (def.karma) this.world.applyKarma(def.karma);
      if (def.standing) {
        this.world.adjustStanding(def.standing.faction, def.standing.delta);
      }
      if (def.pressures) {
        for (const [axis, d] of Object.entries(def.pressures)) {
          this.pressures.adjust(axis, d);
        }
      }
      if (def.flag) this.player.setFlag(def.flag);
      if (def.lore) this.world.unlockLore(def.lore);
    }
  }

  // ── choices ────────────────────────────────────────────────────
  public getPendingChoice(): PendingChoice | null {
    return this.levelManager.getPendingChoice();
  }

  public resolveChoice(optionId: string): boolean {
    return this.levelManager.resolveChoice(optionId);
  }

  // ── progression ────────────────────────────────────────────────
  public getStatus(): GameStatusKind {
    const p = this.player;
    // Health can drop to 0 from an event/choice AFTER the yearly tick, so check
    // the stat directly rather than the (possibly stale) `alive` flag.
    if (p.health <= 0) return "dead";
    if (this.levelManager.isCurrentCleared()) return "cleared";
    return "playing";
  }

  public getCurrentLevelId(): string | null {
    return this.levelManager.getCurrentLevelId();
  }

  public goToNextLevel(): boolean {
    return this.levelManager.goToNextLevel();
  }

  public hasNextLevel(): boolean {
    const id = this.levelManager.current.nextLevel;
    return id !== "none";
  }
}
