import { container, inject } from "../../Container.js";
import Player from "../Player.js";
import ChronicleRegistry from "../chronicle/ChronicleRegistry.js";
import WorldState from "../chronicle/WorldState.js";
import WorldManager from "../../worlds/WorldManager.js";
import RandomService from "../../core/random/RandomService.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import { RegionLogIncident } from "./RegionLogIncident.js";
import {
  canMove,
  emptyRegions,
  moveTo as moveToEngine,
  playerInfluence,
  prosperityTier,
  regionCharacter,
  regionMoodDelta,
  regionYearlyDelta,
  tickRegions,
  type RegionAdjacency,
  type RegionCharacter,
  type RegionEvent,
  type RegionSim,
  type RegionsState,
} from "./regionEngine.js";

/**
 * Regions & migration: the world's places develop, trade, boom, and sometimes
 * collapse into ruin. The player can move between neighbours, inheriting a new
 * region's tone (karma, favoured faction, mood), and their own standing pulls on
 * the place they live. Rules live in the pure `regionEngine`.
 */
export default class RegionsSystem {
  private registry: ChronicleRegistry;
  private world: WorldState;
  private random: RandomService;
  private eventBus: TypedEventBus;
  private adjacency: RegionAdjacency = {};
  private state: RegionsState = { regions: {}, currentId: "", visits: {} };
  private logSeq = 0;
  /** The tier the player's region was in last year, to announce a change once. */
  private lastTier = "";

  constructor() {
    this.registry = inject(ChronicleRegistry);
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
    this.state = emptyRegions(
      defs.map((d) => ({ id: d.id, character: d.character })),
      start,
    );
    this.lastTier = "";
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

  /** A region's character, letting a world's own data override the derived one. */
  private characterOf(id: string): RegionCharacter {
    return regionCharacter(id, this.registry.getRegion(id)?.character);
  }

  private toast(textKey: string, kind: "info" | "success" | "warn" = "info"): void {
    this.eventBus.emit("toast", { textKey, kind });
  }

  private emit(events: RegionEvent[]): void {
    for (const ev of events) {
      const kind = ev.kind === "region.collapse" ? "warn" : "info";
      this.toast(`region.ev.${ev.kind}`, kind);
    }
  }

  public tickYear(player: Player): void {
    const regionId = this.state.currentId || this.world.regionId;
    const events = tickRegions(this.state, this.adjacency, () => this.random.next(), {
      characterOf: (id) => this.characterOf(id),
      influence: { regionId, amount: this.influenceOf(player, regionId) },
    });

    this.emit(events);
    this.applyTone(player, regionId);
    this.noteTier(regionId);
    player.notify();
  }

  /**
   * What the player is worth to the place they live.
   *
   * The faction term reads the region's own favoured faction, so a life spent
   * serving the powers of one place matters most where it was spent.
   */
  private influenceOf(player: Player, regionId: string): number {
    const faction = this.registry.getRegion(regionId)?.favorFaction;
    return playerInfluence({
      money: player.money,
      reputation: player.reputation,
      careerRank: player.careerRank,
      factionStanding: faction ? this.world.standing.get(faction) ?? 0 : 0,
    });
  }

  /** The region's yearly mark on the player — a tone, not a yoke. */
  private applyTone(player: Player, regionId: string): void {
    const delta = regionYearlyDelta(this.state.regions[regionId]);
    if (Object.keys(delta).length > 0) player.applyDelta(delta);

    const happiness = delta.happiness ?? 0;
    if (happiness <= -2) this.toast("region.ev.region.hardship", "warn");
    else if (happiness >= 2) this.toast("region.ev.region.prosper", "success");
  }

  /** Announce the player's region changing tier, once per change. */
  private noteTier(regionId: string): void {
    const sim = this.state.regions[regionId];
    if (!sim) return;
    const tier = prosperityTier(sim);
    if (tier === this.lastTier) return;
    this.lastTier = tier;
    this.log(tier.replace("region.tier.", "region.log.tier."));
  }

  private log(nameKey: string): void {
    // Resolved lazily rather than injected: `WorldManager` injects *this*
    // service, so a constructor dependency would be a cycle the container
    // refuses to build (`Container.resolve` throws on one).
    try {
      container
        .resolve(WorldManager)
        .getCurrentLogStore()
        ?.addEvent(new RegionLogIncident(`region_log_${++this.logSeq}`, nameKey));
    } catch {
      /* no active world — nothing to write to */
    }
  }

  /**
   * Move the player to a neighbouring region.
   *
   * The engine's `moveTo` had no caller anywhere in the repository, which meant
   * a collapsing region was inescapable: the player was pinned to their
   * birthplace for life. Now that a region can genuinely fail, having a way out
   * is what makes the failure a situation rather than a punishment.
   */
  public tryMove(player: Player, targetId: string): RegionEvent[] {
    if (!canMove(this.state, targetId, this.adjacency)) {
      const refused: RegionEvent[] = [
        { kind: "region.unreachable", params: { id: targetId } },
      ];
      this.emit(refused);
      return refused;
    }

    const def = this.registry.getRegion(targetId);
    const sim = this.state.regions[targetId];
    const events = moveToEngine(this.state, targetId);
    this.world.regionId = targetId;
    if (def?.startKarma) this.world.applyKarma(def.startKarma);
    if (def?.favorFaction) this.world.adjustStanding(def.favorFaction, 10);
    if (sim) player.applyDelta({ happiness: regionMoodDelta(sim) });
    // `lore_traveler` is gated on this flag and had no way to be reached either.
    player.setFlag("traveled");
    this.lastTier = "";
    this.emit(events);
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
    this.lastTier = "";
  }
}
