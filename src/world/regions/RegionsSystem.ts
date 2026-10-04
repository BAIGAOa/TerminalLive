import { inject } from "../../Container.js";
import Player from "../Player.js";
import WorldRegistry from "../chronicle/WorldRegistry.js";
import WorldState from "../chronicle/WorldState.js";
import RandomService from "../../core/random/RandomService.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import {
  canMove,
  emptyRegions,
  moveTo as moveToEngine,
  RegionAdjacency,
  RegionEvent,
  RegionSim,
  regionMoodDelta,
  RegionsState,
  tickRegions,
} from "./regionEngine.js";

/**
 * Regions & migration: the world's places develop, trade, boom and falter, and
 * the player can move between neighbours, inheriting a new region's tone
 * (karma, favoured faction, mood). Rules live in the pure `regionEngine`.
 */
export default class RegionsSystem {
  private registry: WorldRegistry;
  private world: WorldState;
  private random: RandomService;
  private eventBus: TypedEventBus;
  private adjacency: RegionAdjacency = {};
  private state: RegionsState = { regions: {}, currentId: "", visits: {} };

  constructor() {
    this.registry = inject(WorldRegistry);
    this.world = inject(WorldState);
    this.random = inject(RandomService);
    this.eventBus = inject(TypedEventBus);
  }

  /** Rebuild from the registry, seeded at the life's starting region. */
  public reset(startId?: string): void {
    const defs = this.registry.getRegions();
    this.adjacency = {};
    for (const d of defs) this.adjacency[d.id] = d.neighbors ?? [];
    const start = startId && this.adjacency[startId] ? startId : defs[0]?.id ?? "";
    this.state = emptyRegions(defs.map((d) => ({ id: d.id })), start);
  }

  public getState(): RegionsState {
    return this.state;
  }

  public getRegion(id: string): RegionSim | undefined {
    return this.state.regions[id];
  }

  public neighbors(id: string): string[] {
    return this.adjacency[id] ?? [];
  }

  public getAdjacency(): RegionAdjacency {
    return this.adjacency;
  }

  private emit(events: RegionEvent[]): void {
    for (const ev of events) {
      this.eventBus.emit("toast", { textKey: `region.ev.${ev.kind}`, kind: "info" });
    }
  }

  public tickYear(player: Player): void {
    this.emit(tickRegions(this.state, this.adjacency, () => this.random.next()));
    player.notify();
  }

  /** Migrate to an adjacent region; inherits its karma, faction favour and mood. */
  public moveTo(player: Player, targetId: string): RegionEvent[] {
    if (!canMove(this.state, targetId, this.adjacency)) {
      return [{ kind: "region.unreachable", params: { id: targetId } }];
    }
    const def = this.registry.getRegion(targetId);
    const sim = this.state.regions[targetId];
    const events = moveToEngine(this.state, targetId);
    this.world.regionId = targetId;
    if (def?.startKarma) this.world.applyKarma(def.startKarma);
    if (def?.favorFaction) this.world.adjustStanding(def.favorFaction, 10);
    if (sim) player.applyDelta({ happiness: regionMoodDelta(sim) });
    player.notify();
    return events;
  }

  public snapshot(): RegionsState {
    return JSON.parse(JSON.stringify(this.state)) as RegionsState;
  }

  public restore(state: RegionsState | undefined): void {
    if (!state) return;
    // Adjacency is derived from the registry, not the save — rebuild it so
    // migration/neighbours still work after a load without a fresh reset().
    this.adjacency = {};
    for (const d of this.registry.getRegions()) this.adjacency[d.id] = d.neighbors ?? [];
    this.state = JSON.parse(JSON.stringify(state));
  }
}
