import { inject } from "../../Container.js";
import Player from "../Player.js";
import WorldState from "../chronicle/WorldState.js";
import PressureState from "../pressures/PressureState.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import { worldChainsById } from "../../content/WorldChains.js";
import { ChainDef } from "./worldChainEngine.js";
import {
  absorbMarketBias,
  ChainContext,
  ChainFireEvent,
  ChainState,
  emptyChainState,
  tickChains,
} from "./worldChainEngine.js";

/**
 * Drives cascading world-event chains. On each turn it advances the chains,
 * fires due nodes whose conditions hold, and applies their effects to the
 * world's karma/standing, the pressure web and the player's flags — feeding a
 * lingering market tilt back to the economy. Rules live in the pure engine.
 */
export default class WorldChainSystem {
  private world: WorldState;
  private pressures: PressureState;
  private eventBus: TypedEventBus;
  private defs: Record<string, ChainDef> = worldChainsById();
  private state: ChainState = emptyChainState();

  constructor() {
    this.world = inject(WorldState);
    this.pressures = inject(PressureState);
    this.eventBus = inject(TypedEventBus);
  }

  public reset(): void {
    this.state = emptyChainState();
  }

  public getState(): ChainState {
    return this.state;
  }

  public marketBias(): number {
    return this.state.marketBias;
  }

  /** Chain ids currently in flight (started but not yet concluded). */
  public activeChains(): string[] {
    const ids = new Set(this.state.active.map((p) => p.chainId));
    return [...ids];
  }

  public tickYear(player: Player): void {
    const ctx: ChainContext = {
      year: this.world.year,
      flags: player.flags,
      pressures: { ...this.pressures.snapshot() },
      standing: Object.fromEntries(this.world.standing),
    };
    const events = tickChains(this.state, this.defs, ctx);
    for (const ev of events) this.apply(player, ev);
    player.notify();
  }

  private apply(player: Player, ev: ChainFireEvent): void {
    const e = ev.effects;
    if (e.karma) this.world.applyKarma(e.karma);
    if (e.standing) {
      for (const [faction, delta] of Object.entries(e.standing)) {
        this.world.adjustStanding(faction, delta);
      }
    }
    if (e.pressures) {
      for (const [axis, delta] of Object.entries(e.pressures)) {
        this.pressures.adjust(axis, delta);
      }
    }
    if (e.flag) player.setFlag(e.flag);
    absorbMarketBias(this.state, e.marketBias);
    this.eventBus.emit("toast", { textKey: ev.labelKey, kind: "warn" });
  }

  public snapshot(): ChainState {
    return JSON.parse(JSON.stringify(this.state)) as ChainState;
  }

  public restore(state: ChainState | undefined): void {
    if (state) this.state = JSON.parse(JSON.stringify(state));
  }
}
