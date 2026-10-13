import { inject } from "../../Container.js";
import Player from "../Player.js";
import CareerRegistry from "./CareerRegistry.js";
import { meetsRequirements } from "../requirements.js";
import RandomService from "../../core/random/RandomService.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import {
  emptyWorkState,
  gateSatisfied,
  GUILD_CERT,
  guildBlocks,
  hasCert,
  hazardDrain,
  paidSalary,
  promotionGate,
  publicityDrift,
  startVenture,
  tickVenture,
  tickWork,
  tryPromote,
  workAction as workAction_,
  WorkActionId,
  WorkEvent,
  WorkState,
  WorkStats,
} from "./careerEngine.js";
import type { CareerDefinition, CareerRank } from "./CareerDefinition.js";
import { buildCareerBoard, entryMet, type CareerCard } from "./careerBoard.js";
import {
  attemptRefusal,
  resignation,
  startCooldown,
} from "./hiring.js";
import type { StatDelta } from "../stats.js";

/** Years nobody will hire you after a dismissal. */
const HIRING_BAN_YEARS = 3;

export interface CareerState {
  career: CareerDefinition;
  rank: number;
  rankDef: CareerRank;
  salary: number;
  next?: { rankDef: CareerRank; met: boolean; gateMet: boolean };
}

/**
 * Jobs and careers. Beyond the salary ladder, a life-track of work state is
 * simulated yearly: performance, burnout, skills, office politics and an
 * optional self-run venture. The heavy logic lives in the pure `careerEngine`.
 */
export default class CareerSystem {
  private registry: CareerRegistry;
  private random: RandomService;
  private eventBus: TypedEventBus;
  private work: WorkState = emptyWorkState();

  constructor() {
    this.registry = inject(CareerRegistry);
    this.random = inject(RandomService);
    this.eventBus = inject(TypedEventBus);
  }

  public getAll(): CareerDefinition[] {
    return this.registry.getAll();
  }

  public get(id: string): CareerDefinition | undefined {
    return this.registry.get(id);
  }

  public getWork(): WorkState {
    return this.work;
  }

  /** Reset per-life work state (a new life starts clean). */
  public reset(): void {
    this.work = emptyWorkState();
  }

  /** The job board, as the career picker renders it. */
  public getBoard(player: Player): CareerCard[] {
    return buildCareerBoard(player, this.registry.getAll(), this.work, this.now(player));
  }

  /** The year a gate is measured against — the player's age. */
  private now(player: Player): number {
    return Math.floor(player.age);
  }

  /**
   * Why an *attempt* is refused — cooldown or action points. Separate from
   * {@link joinBlocker}, which answers whether the player qualifies: a job you
   * are qualified for can still be one you cannot afford to apply to today.
   */
  public attemptBlocker(
    player: Player,
    careerId: string,
  ): { key: string; params?: Record<string, string | number> } | null {
    const career = this.registry.get(careerId);
    if (!career) return { key: "career.err.unknown" };
    return attemptRefusal(career, this.work, player.actionPoints, this.now(player));
  }

  /**
   * Charge one application: spend its action points and start its cooldown.
   *
   * Called for a failed interview as well as a successful one, so retrying a
   * rejection is a real decision rather than a free reroll.
   */
  public consumeAttempt(player: Player, careerId: string): boolean {
    const career = this.registry.get(careerId);
    if (!career || player.actionPoints < career.terms.applyAp) return false;
    player.actionPoints -= career.terms.applyAp;
    this.work = startCooldown(
      this.work,
      careerId,
      career.terms.applyCooldown,
      this.now(player),
    );
    player.notify();
    return true;
  }

  /**
   * Why this job cannot be taken right now, as an i18n key — or `null` when it
   * can. Every route into a career (the board, an event's `career` payload, a
   * mod action) goes through this, so the entry gates cannot be bypassed by
   * picking a different door.
   */
  public joinBlocker(player: Player, careerId: string): string | null {
    const career = this.registry.get(careerId);
    if (!career) return "career.err.unknown";
    if (player.careerId === careerId) return null;
    // Just dismissed: nobody is hiring, whatever the trade. Checked before the
    // gates so the refusal names the real reason.
    if (this.now(player) < (this.work.banUntil ?? 0)) return "career.err.banned";
    const held = player.careerId ? this.registry.get(player.careerId) : undefined;
    if (held?.lifelong) return "career.err.sealed";
    if (!entryMet(player, career)) return "career.err.gates";
    return null;
  }

  public canJoin(player: Player, careerId: string): boolean {
    return this.joinBlocker(player, careerId) === null;
  }

  /** Take a job (rank 0). Replaces any current job on the player and engine. */
  public join(player: Player, careerId: string): boolean {
    const blocker = this.joinBlocker(player, careerId);
    if (blocker !== null) {
      // A refused join has to say why: silently doing nothing reads as a bug.
      this.eventBus.emit("toast", { textKey: blocker, kind: "warn" });
      return false;
    }
    // Re-taking the same job must not wipe the ladder the player has climbed —
    // events and repeated content can both re-offer the job they already hold.
    if (player.careerId === careerId) return true;

    // Cooldowns are per-career and outlive the job that set them, so only the
    // work *track* is reset here, not the whole state.
    this.work = { ...emptyWorkState(), careerId, rank: 0, cooldowns: this.work.cooldowns };
    player.careerId = careerId;
    player.careerRank = 0;
    player.notify();
    // Announced on the bus rather than called directly: the mail system wants
    // to react (a new boss writes to you), and reaching for it here would close
    // a dependency cycle through RelationshipSystem → WorldManager → here.
    this.eventBus.emit("career:joined", { careerId, rank: 0 });
    return true;
  }

  /** Why the player cannot resign right now, or `null` when they can. */
  public resignBlocker(player: Player): string | null {
    if (!player.careerId) return "career.err.noJob";
    const held = this.registry.get(player.careerId);
    if (held?.lifelong) return "career.err.lifelong";
    return null;
  }

  /**
   * Walk out. Charges the career's resignation terms, scaled down by tenure,
   * and closes the field to the player for its cooldown.
   */
  public resign(player: Player): {
    ok: boolean;
    blocker?: string;
    cost?: StatDelta;
    cooldown?: number;
    halfNotice?: boolean;
  } {
    const blocker = this.resignBlocker(player);
    if (blocker) {
      this.eventBus.emit("toast", { textKey: blocker, kind: "warn" });
      return { ok: false, blocker };
    }
    const careerId = player.careerId!;
    const held = this.registry.get(careerId)!;
    const { cost, cooldown, halfNotice } = resignation(held, this.work.tenure);

    player.applyDelta(cost);
    this.work = startCooldown(this.work, careerId, cooldown, this.now(player));
    this.work = { ...this.work, careerId: null, rank: 0, tenure: 0 };
    player.careerId = null;
    player.careerRank = 0;
    player.notify();
    this.eventBus.emit("career:resigned", { careerId, rank: held.ranks.length });
    return { ok: true, cost, cooldown, halfNotice };
  }

  /** Event/mod-driven resignation: the same price as pressing the button. */
  public quit(player: Player): void {
    this.resign(player);
  }

  public rankOf(player: Player): CareerRank | null {
    const career = player.careerId
      ? this.registry.get(player.careerId)
      : undefined;
    return career?.ranks[player.careerRank] ?? null;
  }

  public salaryOf(player: Player): number {
    return this.rankOf(player)?.salary ?? 0;
  }

  /** A player-driven work action; returns the narration events it produced. */
  public workAction(id: WorkActionId): WorkEvent[] {
    return workAction_(this.work, id);
  }

  /** Start a venture, debiting the starting capital from the player. */
  public investVenture(player: Player, industry: string, capital: number): WorkEvent[] {
    if (this.work.venture) return [{ kind: "venture.alreadyRunning" }];
    if (player.money < capital) return [{ kind: "venture.tooPoor" }];
    const events = startVenture(this.work, industry, capital);
    // Debit only if a venture actually started (startVenture rejects capital
    // below the minimum without touching state).
    if (this.work.venture) {
      player.applyDelta({ money: -capital });
      player.notify();
    }
    return events;
  }

  /** Snapshot for the UI / console. */
  public getState(player: Player): CareerState | null {
    const career = player.careerId
      ? this.registry.get(player.careerId)
      : undefined;
    if (!career || career.ranks.length === 0) return null;
    const rank = Math.min(player.careerRank, career.ranks.length - 1);
    const rankDef = career.ranks[rank];
    const nextDef = career.ranks[rank + 1];
    return {
      career,
      rank,
      rankDef,
      salary: rankDef.salary,
      next: nextDef
        ? {
            rankDef: nextDef,
            met: meetsRequirements(player, nextDef.requires),
            gateMet: gateSatisfied(this.work, promotionGate(rank)),
          }
        : undefined,
    };
  }

  private statsOf(player: Player): WorkStats {
    return {
      intelligence: player.intelligence,
      social: player.social,
      fitness: player.fitness,
      health: player.health,
      happiness: player.happiness,
      age: player.age,
    };
  }

  private emit(events: WorkEvent[]): void {
    for (const ev of events) {
      this.eventBus.emit("toast", { textKey: `career.ev.${ev.kind}`, kind: "info" });
    }
  }

  /** Yearly tick: salary, work dynamics, promotion, and the venture. */
  public tickYear(player: Player): void {
    const career = player.careerId
      ? this.registry.get(player.careerId)
      : undefined;

    if (career && career.ranks.length > 0) {
      const rank = Math.min(player.careerRank, career.ranks.length - 1);
      this.work.careerId = career.id;
      this.work.rank = rank;
      const events = tickWork(this.work, this.statsOf(player), this.random.next.bind(this.random));
      this.emit(events);

      // Showed the door: no pay, no rung, no standing. The rest of this block
      // is about a job the player still has.
      if (events.some((ev) => ev.kind === "work.fired")) {
        this.fired(player, career.id);
        player.notify();
        return this.tickVenture(player);
      }

      // Pay is settled after the year's work, so a commission job is paid for
      // the year it actually had rather than for the rank alone.
      const pay = paidSalary(
        career.ranks[rank].salary,
        career.mechanics,
        this.work.performance,
      );
      if (pay > 0) player.applyDelta({ money: pay });

      const hazard = hazardDrain(career.mechanics);
      if (hazard > 0) player.applyDelta({ health: -hazard });

      const drift = publicityDrift(career.mechanics, this.work.performance);
      if (drift !== 0) player.applyDelta({ reputation: drift });

      const next = career.ranks[rank + 1];
      const guildOpen = !guildBlocks(
        career.mechanics,
        rank,
        hasCert(this.work, GUILD_CERT),
      );
      if (
        next &&
        guildOpen &&
        tryPromote(this.work, career.ranks.length, meetsRequirements(player, next.requires))
      ) {
        player.careerRank = this.work.rank;
        this.emit([{ kind: "work.promoted", params: { title: next.titleKey } }]);
        // The boss has something to say about this; the mail system listens.
        this.eventBus.emit("career:promoted", {
          careerId: career.id,
          rank: this.work.rank,
        });
      }
      player.notify();
    }

    this.tickVenture(player);
  }

  /** The venture runs whether or not the player still has a day job. */
  private tickVenture(player: Player): void {
    if (!this.work.venture) return;
    const venture = this.work.venture;
    const result = tickVenture(venture, this.random.next.bind(this.random));
    // The owner draws a dividend out of PROFIT (revenue net of the wage bill),
    // and it is debited from capital so no money is conjured.
    const profit = result.revenue - venture.staff * 12;
    if (profit > 0) {
      const dividend = Math.min(Math.round(profit * 0.3), venture.capital);
      venture.capital -= dividend;
      if (dividend > 0) player.applyDelta({ money: dividend });
    }
    this.emit(result.events);
    if (result.bankrupt) this.work.venture = null;
    player.notify();
  }

  /**
   * Let go. The counterpart to {@link resign}, and deliberately not the same
   * thing: no resignation terms are charged, but the trade closes behind you
   * and the shame is its own cost.
   */
  public fired(player: Player, careerId: string): void {
    const career = this.registry.get(careerId);
    // Cooldowns are per-career and outlive the job that set them.
    const carried = this.work.cooldowns;
    const now = this.now(player);
    this.work = startCooldown(
      { ...emptyWorkState(), cooldowns: carried },
      careerId,
      career?.terms.resignCooldown ?? 2,
      now,
    );
    // Being dismissed is not the same as resigning: the trade closes behind you
    // *and* nobody else takes you on for a while.
    this.work.banUntil = now + HIRING_BAN_YEARS;
    player.careerId = null;
    player.careerRank = 0;
    player.applyDelta({ reputation: -5, happiness: -6, depressionValue: 3 });
    player.notify();
    // Grief, shame and a closed door. The health system is listening; so is
    // the mail system, which is how the boss gets to say something about it.
    this.eventBus.emit("career:fired", { careerId });
  }

  public snapshot(): { work: WorkState } {
    return { work: JSON.parse(JSON.stringify(this.work)) as WorkState };
  }

  public restore(snap: { work?: WorkState } | undefined): void {
    if (snap?.work) this.work = JSON.parse(JSON.stringify(snap.work)) as WorkState;
  }
}
