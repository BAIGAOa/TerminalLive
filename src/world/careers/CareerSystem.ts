import { inject } from "../../Container.js";
import Player from "../Player.js";
import CareerRegistry from "./CareerRegistry.js";
import { meetsRequirements } from "../requirements.js";
import RandomService from "../../core/random/RandomService.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import {
  emptyWorkState,
  gateSatisfied,
  promotionGate,
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

  /** Take a job (rank 0). Replaces any current job on the player and engine. */
  public join(player: Player, careerId: string): boolean {
    const career = this.registry.get(careerId);
    if (!career) return false;
    player.careerId = careerId;
    player.careerRank = 0;
    this.work.careerId = careerId;
    this.work.rank = 0;
    this.work.tenure = 0;
    player.notify();
    return true;
  }

  public quit(player: Player): void {
    player.careerId = null;
    player.careerRank = 0;
    this.work.careerId = null;
    this.work.rank = 0;
    player.notify();
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
      const pay = career.ranks[rank].salary;
      if (pay > 0) player.applyDelta({ money: pay });

      this.work.careerId = career.id;
      this.work.rank = rank;
      const events = tickWork(this.work, this.statsOf(player), this.random.next.bind(this.random));
      this.emit(events);

      const next = career.ranks[rank + 1];
      if (
        next &&
        tryPromote(this.work, career.ranks.length, meetsRequirements(player, next.requires))
      ) {
        player.careerRank = this.work.rank;
        this.emit([{ kind: "work.promoted", params: { title: next.titleKey } }]);
      }
      player.notify();
    }

    if (this.work.venture) {
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
  }

  public snapshot(): { work: WorkState } {
    return { work: JSON.parse(JSON.stringify(this.work)) as WorkState };
  }

  public restore(snap: { work?: WorkState } | undefined): void {
    if (snap?.work) this.work = JSON.parse(JSON.stringify(snap.work)) as WorkState;
  }
}
