import { inject } from "../../Container.js";
import Player from "../Player.js";
import WorldRegistry from "../chronicle/WorldRegistry.js";
import WorldState from "../chronicle/WorldState.js";
import RandomService from "../../core/random/RandomService.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import {
  dominantFaction,
  emptyPolitics,
  marketBiasOf,
  PoliticsEvent,
  PoliticsState,
  publicOrder,
  setLean,
  tickPolitics,
} from "./politicsEngine.js";

/**
 * Inter-faction politics: power blocs that relate, drift, set tension and enact
 * policies. Runs alongside the world's per-player faction standing (WorldState)
 * and feeds a market bias to the economy. Rules live in the pure engine.
 */
export default class PoliticsSystem {
  private registry: WorldRegistry;
  private world: WorldState;
  private random: RandomService;
  private eventBus: TypedEventBus;
  private state: PoliticsState = { factions: {}, tension: 30, policies: [], playerLean: null };

  constructor() {
    this.registry = inject(WorldRegistry);
    this.world = inject(WorldState);
    this.random = inject(RandomService);
    this.eventBus = inject(TypedEventBus);
  }

  public reset(): void {
    const factions = this.registry
      .getFactions()
      .map((f) => ({ id: f.id, rivals: f.rivals }));
    this.state = emptyPolitics(factions);
  }

  public getState(): PoliticsState {
    return this.state;
  }

  public dominantFaction(): string | null {
    return dominantFaction(this.state);
  }

  public marketBias(): number {
    return marketBiasOf(this.state);
  }

  public publicOrder(): number {
    return publicOrder(this.state);
  }

  /** Throw in with a faction (or clear with null); nudges the world's standing. */
  public align(player: Player, factionId: string | null): void {
    setLean(this.state, factionId);
    if (factionId) this.world.adjustStanding(factionId, 8);
    player.notify();
  }

  private standingRecord(): Record<string, number> {
    return Object.fromEntries(this.world.standing);
  }

  private emit(events: PoliticsEvent[]): void {
    for (const ev of events) {
      this.eventBus.emit("toast", { textKey: `politics.ev.${ev.kind}`, kind: "info" });
    }
  }

  public tickYear(player: Player): void {
    const events = tickPolitics(this.state, () => this.random.next(), this.standingRecord());
    this.emit(events);
    player.notify();
  }

  public snapshot(): PoliticsState {
    return JSON.parse(JSON.stringify(this.state)) as PoliticsState;
  }

  public restore(state: PoliticsState | undefined): void {
    if (state) this.state = JSON.parse(JSON.stringify(state)) as PoliticsState;
  }
}
