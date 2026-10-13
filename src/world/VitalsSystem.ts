import { inject } from "../Container.js";
import Player from "./Player.js";
import RandomService from "../core/random/RandomService.js";
import TypedEventBus from "../core/TypedEventBus.js";
import NpcRegistry from "./relationships/NpcRegistry.js";
import HealthSystem from "./health/HealthSystem.js";
import CouplingRegistry from "../core/registry/CouplingRegistry.js";
import {
  evaluateVitals,
  type VitalsContext,
  type VitalsOutcome,
} from "./vitalsEngine.js";

/** Affinity at which a tie counts as real, for the loneliness rules. */
const BOND_AFFINITY = 40;
/** Affinity at which a partner counts as a partner. */
const PARTNER_AFFINITY = 50;

/**
 * The player's numbers reacting to each other.
 *
 * `vitalsEngine` holds the rules; this holds the wiring — reading the systems
 * the rules need, applying the result, and telling the player when something
 * was diagnosed or indulged. Runs near the end of the turn so it reads the
 * year's settled figures rather than a half-applied one.
 */
export default class VitalsSystem {
  private random: RandomService;
  private eventBus: TypedEventBus;
  private npcs: NpcRegistry;
  private health: HealthSystem;
  private couplings: CouplingRegistry;

  /**
   * How often each coupling has fired since boot.
   *
   * Exposed because a rule table is impossible to balance by reading: the
   * question is never "is this rule fair" but "is this rule firing on 90% of
   * years", and only the balance harness can answer that.
   */
  public readonly fireCounts = new Map<string, number>();

  constructor() {
    this.random = inject(RandomService);
    this.eventBus = inject(TypedEventBus);
    this.npcs = inject(NpcRegistry);
    this.health = inject(HealthSystem);
    this.couplings = inject(CouplingRegistry);
  }

  /** Assemble what the rules may read. */
  private contextOf(player: Player): VitalsContext {
    const state = this.health.getState();
    let bonded = false;
    let partnered = false;
    for (const [npcId, affinity] of player.relationships) {
      if (affinity < BOND_AFFINITY) continue;
      const role = this.npcs.get(npcId)?.roleKey;
      if (!role) continue;
      if (role === "npc.role.partner" && affinity >= PARTNER_AFFINITY) {
        partnered = true;
        bonded = true;
      } else if (
        role === "npc.role.family" ||
        role === "npc.role.friend" ||
        role === "npc.role.mentor"
      ) {
        bonded = true;
      }
    }

    return {
      age: player.age,
      health: player.health,
      height: player.height,
      weight: player.weight,
      intelligence: player.intelligence,
      social: player.social,
      fitness: player.fitness,
      happiness: player.happiness,
      reputation: player.reputation,
      appearance: player.appearance,
      angerValue: player.angerValue,
      excitationValue: player.excitationValue,
      depressionValue: player.depressionValue,
      weakValue: player.weakValue,
      money: player.money,
      conditions: new Set(Object.keys(state.conditions)),
      addictions: new Set(Object.keys(state.addictions)),
      bonded,
      partnered,
      employed: player.careerId !== null,
    };
  }

  /**
   * One year of reactions. Returns what the table decided, so a test can
   * assert on it without reaching into the player.
   */
  public tickYear(player: Player): VitalsOutcome {
    const outcome = evaluateVitals(
      this.contextOf(player),
      this.random.next.bind(this.random),
      this.couplings.rules(),
    );

    for (const id of outcome.fired) {
      this.fireCounts.set(id, (this.fireCounts.get(id) ?? 0) + 1);
    }

    if (Object.keys(outcome.delta).length > 0) player.applyDelta(outcome.delta);

    // A condition is news the player must be told about — silently acquiring
    // depression would read as a mystery, not a consequence.
    for (const id of outcome.acquire) {
      this.emit(this.health.diagnose(id, 20, Math.floor(player.age)));
    }
    for (const id of outcome.indulge) {
      this.emit(this.health.useSubstance(id));
    }
    for (const id of outcome.tend) {
      this.emit(this.health.seekHelp(id));
    }

    // The year is now settled, so this is the first honest moment to recompute
    // action points — recomputing them earlier in the turn read last year's
    // health and happiness.
    player.recomputeActionPoints();
    player.notify();
    return outcome;
  }

  private emit(events: Array<{ kind: string; params?: Record<string, unknown> }>): void {
    for (const ev of events) {
      this.eventBus.emit("toast", { textKey: `health.ev.${ev.kind}`, kind: "info" });
    }
  }
}
