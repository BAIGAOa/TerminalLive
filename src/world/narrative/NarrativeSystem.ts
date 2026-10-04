import { inject } from "../../Container.js";
import Player from "../Player.js";
import WorldState from "../chronicle/WorldState.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import { arcsById } from "../../content/Arcs.js";
import {
  activeArcs,
  ArcContext,
  ArcDef,
  arcProgress,
  ArcState,
  emptyNarrative,
  NarrativeState,
  tickArcs,
} from "./narrativeEngine.js";

/**
 * Advances the life's long-form arcs each year and remembers milestones. Rules
 * live in the pure `narrativeEngine`; this singleton holds per-life state and
 * snapshots into the save.
 */
export default class NarrativeSystem {
  private world: WorldState;
  private eventBus: TypedEventBus;
  private defs: Record<string, ArcDef> = arcsById();
  private state: NarrativeState = emptyNarrative();

  constructor() {
    this.world = inject(WorldState);
    this.eventBus = inject(TypedEventBus);
  }

  public reset(): void {
    this.state = emptyNarrative();
  }

  public getState(): NarrativeState {
    return this.state;
  }

  public getArcs(): Array<{ def: ArcDef; state: ArcState; progress: number }> {
    return activeArcs(this.state, this.defs).map((a) => ({
      ...a,
      progress: arcProgress(a.state, a.def),
    }));
  }

  private contextOf(player: Player): ArcContext {
    let maxRelationship = 0;
    for (const v of player.relationships.values()) {
      if (v > maxRelationship) maxRelationship = v;
    }
    return {
      age: player.age,
      stats: {
        age: player.age,
        health: player.health,
        money: player.money,
        intelligence: player.intelligence,
        social: player.social,
        fitness: player.fitness,
        happiness: player.happiness,
        reputation: player.reputation,
      },
      flags: player.flags,
      karma: { ...this.world.karma },
      maxRelationship,
      careerRank: player.careerRank,
      hasCareer: player.careerId !== null,
    };
  }

  public tickYear(player: Player): void {
    const events = tickArcs(this.state, this.defs, this.contextOf(player));
    for (const ev of events) {
      this.eventBus.emit("toast", { textKey: ev.labelKey, kind: "success" });
    }
    player.notify();
  }

  public snapshot(): NarrativeState {
    return JSON.parse(JSON.stringify(this.state)) as NarrativeState;
  }

  public restore(state: NarrativeState | undefined): void {
    if (state) this.state = JSON.parse(JSON.stringify(state));
  }
}
