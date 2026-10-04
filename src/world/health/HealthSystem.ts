import { inject } from "../../Container.js";
import Player from "../Player.js";
import RandomService from "../../core/random/RandomService.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import {
  acquireCondition,
  emptyHealthState,
  HealthEvent,
  HealthState,
  HealthStats,
  lifeExpectancy,
  tendAddiction,
  tickHealth,
  treatCondition,
  useAddiction,
  wellbeing,
} from "./healthEngine.js";

/**
 * The player's body and mind across a life: chronic/mental conditions, trauma,
 * resilience, meaning and addictions. Rules live in the pure `healthEngine`;
 * this singleton holds per-life state, applies the yearly effects to the player,
 * and snapshots into the save.
 */
export default class HealthSystem {
  private random: RandomService;
  private eventBus: TypedEventBus;
  private state: HealthState = emptyHealthState();

  constructor() {
    this.random = inject(RandomService);
    this.eventBus = inject(TypedEventBus);
  }

  public reset(): void {
    this.state = emptyHealthState();
  }

  public getState(): HealthState {
    return this.state;
  }

  public lifeExpectancy(player: Player): number {
    return lifeExpectancy(this.state, this.statsOf(player));
  }

  public wellbeing(): number {
    return wellbeing(this.state);
  }

  public treat(conditionId: string, amount = 25): HealthEvent[] {
    const ok = treatCondition(this.state, conditionId, amount);
    return [{ kind: ok ? "health.treated" : "health.noCondition", params: { id: conditionId } }];
  }

  public useSubstance(id: string, amount = 8): HealthEvent[] {
    useAddiction(this.state, id, amount);
    return [{ kind: "health.indulged", params: { id } }];
  }

  public seekHelp(id: string, amount = 20): HealthEvent[] {
    if (!tendAddiction(this.state, id, amount)) {
      return [{ kind: "health.noCondition", params: { id } }];
    }
    return [{ kind: "health.recovering", params: { id } }];
  }

  public diagnose(id: string, severity = 20): HealthEvent[] {
    acquireCondition(this.state, id, 0, severity);
    return [{ kind: "health.diagnosed", params: { id } }];
  }

  private statsOf(player: Player): HealthStats {
    return {
      age: player.age,
      fitness: player.fitness,
      social: player.social,
      happiness: player.happiness,
    };
  }

  private emit(events: HealthEvent[]): void {
    for (const ev of events) {
      this.eventBus.emit("toast", { textKey: `health.ev.${ev.kind}`, kind: "info" });
    }
  }

  /** One year: conditions progress, trauma/meaning drift, addictions recede. */
  public tickYear(player: Player): void {
    const { vitalityDrag, moodDelta, events } = tickHealth(
      this.state,
      this.statsOf(player),
      () => this.random.next(),
    );
    const effects: Record<string, number> = {};
    if (vitalityDrag !== 0) effects.health = -vitalityDrag;
    if (moodDelta !== 0) {
      effects.happiness = moodDelta;
      effects.depressionValue = -moodDelta;
    }
    if (Object.keys(effects).length > 0) player.applyDelta(effects);
    this.emit(events);
    player.notify();
  }

  public snapshot(): HealthState {
    return JSON.parse(JSON.stringify(this.state)) as HealthState;
  }

  public restore(state: HealthState | undefined): void {
    if (state) this.state = JSON.parse(JSON.stringify(state)) as HealthState;
  }
}
