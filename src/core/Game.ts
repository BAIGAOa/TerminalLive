import { inject } from "../Container.js";
import Player from "../world/Player.js";
import WorldManager from "../worlds/WorldManager.js";
import ActionRegistry from "../game/actions/ActionRegistry.js";
import { ActionDefinition } from "../game/actions/ActionDefinition.js";
import { meetsRequirements } from "../world/requirements.js";
import { applyEffectPayload } from "../world/effects/applyEffects.js";
import TypedEventBus from "./TypedEventBus.js";
import { PendingChoice } from "../event/PendingChoice.js";
import WorldState from "../world/chronicle/WorldState.js";
import ChronicleRegistry from "../world/chronicle/ChronicleRegistry.js";
import PressureState from "../world/pressures/PressureState.js";
import WeatherState from "../world/weather/WeatherState.js";
import RelationshipSystem from "../world/relationships/RelationshipSystem.js";
import CareerSystem from "../world/careers/CareerSystem.js";
import EconomySystem from "../world/economy/EconomySystem.js";
import HealthSystem from "../world/health/HealthSystem.js";
import PoliticsSystem from "../world/politics/PoliticsSystem.js";
import RegionsSystem from "../world/regions/RegionsSystem.js";
import WorldChainSystem from "../world/chains/WorldChainSystem.js";
import NarrativeSystem from "../world/narrative/NarrativeSystem.js";
import RandomService from "./random/RandomService.js";
import WorldRuleEngine from "../world/rules/WorldRuleEngine.js";

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
  private levelManager: WorldManager;
  private actions: ActionRegistry;
  private eventBus: TypedEventBus;
  private world: WorldState;
  private worldRegistry: ChronicleRegistry;
  private pressures: PressureState;
  private weather: WeatherState;
  private relationships: RelationshipSystem;
  private careers: CareerSystem;
  private economy: EconomySystem;
  private health: HealthSystem;
  private politics: PoliticsSystem;
  private regions: RegionsSystem;
  private chains: WorldChainSystem;
  private narrative: NarrativeSystem;
  private random: RandomService;
  private rules: WorldRuleEngine;

  constructor() {
    this.levelManager = inject(WorldManager);
    this.actions = inject(ActionRegistry);
    this.eventBus = inject(TypedEventBus);
    this.world = inject(WorldState);
    this.worldRegistry = inject(ChronicleRegistry);
    this.pressures = inject(PressureState);
    this.weather = inject(WeatherState);
    this.relationships = inject(RelationshipSystem);
    this.careers = inject(CareerSystem);
    this.economy = inject(EconomySystem);
    this.politics = inject(PoliticsSystem);
    this.regions = inject(RegionsSystem);
    this.chains = inject(WorldChainSystem);
    this.narrative = inject(NarrativeSystem);
    this.health = inject(HealthSystem);
    this.random = inject(RandomService);
    this.rules = inject(WorldRuleEngine);
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
        career: def.career,
      },
      this.world,
    );
    p.notify();
    this.eventBus.emit("action:performed", { actionId });
    this.eventBus.emit("player:updated");
    return true;
  }

  // ── npc interaction ────────────────────────────────────────────
  /** Perform a relationship interaction (talk / gift / …) with an NPC. */
  public interactWithNpc(npcId: string, interactionId: string): boolean {
    const ok = this.relationships.interact(npcId, interactionId);
    if (ok) {
      this.eventBus.emit("action:performed", {
        actionId: `npc:${npcId}:${interactionId}`,
      });
      this.eventBus.emit("player:updated");
    }
    return ok;
  }

  // ── turn ───────────────────────────────────────────────────────
  public endTurn(): void {
    // Advance the world BEFORE rolling this year's event, so world/weather/
    // pressure gates and bias read the current year, not last year's.
    this.advanceWorld();
    this.levelManager.update();
    // Let the NPCs act — unless an event already paused the turn on a choice.
    if (!this.levelManager.hasPendingChoice()) {
      this.relationships.tickYear(this.player);
    }
    // Pay the salary and consider a promotion.
    this.careers.tickYear(this.player);
    // Politics evolve first, then tilt the market.
    this.politics.tickYear(this.player);
    // Regions develop, trade and shift population.
    this.regions.tickYear(this.player);
    // Cascade world-event chains (war → shortage → unrest → coup …).
    this.chains.tickYear(this.player);
    // Advance the life's long-form narrative arcs.
    this.narrative.tickYear(this.player);
    // Drift the market and settle dividends / interest / rent.
    this.economy.tickYear(
      this.player,
      this.politics.marketBias() + this.chains.marketBias(),
    );
    // Age the body and mind: conditions, trauma, meaning, addictions.
    this.health.tickYear(this.player);
    this.eventBus.emit("turn:ended", { age: this.player.age });
  }

  /** Advance the chronicle + hidden-score web a year; surface changes as toasts. */
  private advanceWorld(): void {
    // The pressure web rolls first so this year's weather + events read fresh state.
    this.pressures.tick(this.random.rand, 0.4);

    // The world's rules impose a flat per-year drift on the player.
    const drift = this.rules.drift();
    if (Object.keys(drift).length > 0) this.player.applyDelta(drift);

    // Weather: drawn from the current state, biased by climate/season/pressures.
    const weather = this.weather.advance(
      this.player.age,
      this.world.climate(),
      this.pressures,
      this.random.rand,
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

  public getCurrentWorldId(): string | null {
    return this.levelManager.getCurrentWorldId();
  }
}
