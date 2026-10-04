import { inject } from "../../Container.js";
import Player from "../Player.js";
import CareerRegistry from "./CareerRegistry.js";
import { meetsRequirements } from "../requirements.js";
import type { CareerDefinition, CareerRank } from "./CareerDefinition.js";

export interface CareerState {
  career: CareerDefinition;
  rank: number;
  rankDef: CareerRank;
  salary: number;
  next?: { rankDef: CareerRank; met: boolean };
}

/**
 * Jobs and careers: joining a track, earning a yearly salary, and rising
 * through its ranks when the promotion gates are met.
 */
export default class CareerSystem {
  private registry: CareerRegistry;

  constructor() {
    this.registry = inject(CareerRegistry);
  }

  public getAll(): CareerDefinition[] {
    return this.registry.getAll();
  }

  public get(id: string): CareerDefinition | undefined {
    return this.registry.get(id);
  }

  /** Take a job (rank 0). Replaces any current job. */
  public join(player: Player, careerId: string): boolean {
    const career = this.registry.get(careerId);
    if (!career) return false;
    player.careerId = careerId;
    player.careerRank = 0;
    player.notify();
    return true;
  }

  public quit(player: Player): void {
    player.careerId = null;
    player.careerRank = 0;
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

  /** Snapshot for the UI / console. */
  public getState(player: Player): CareerState | null {
    const career = player.careerId
      ? this.registry.get(player.careerId)
      : undefined;
    if (!career) return null;
    const rank = Math.min(player.careerRank, career.ranks.length - 1);
    const rankDef = career.ranks[rank];
    const nextDef = career.ranks[rank + 1];
    return {
      career,
      rank,
      rankDef,
      salary: rankDef.salary,
      next: nextDef
        ? { rankDef: nextDef, met: meetsRequirements(player, nextDef.requires) }
        : undefined,
    };
  }

  /** Yearly tick: pay the salary, then try to promote. */
  public tickYear(player: Player): void {
    const career = player.careerId
      ? this.registry.get(player.careerId)
      : undefined;
    if (!career) return;

    const rank = Math.min(player.careerRank, career.ranks.length - 1);
    const pay = career.ranks[rank].salary;
    if (pay > 0) player.applyDelta({ money: pay });

    const next = career.ranks[rank + 1];
    if (next && meetsRequirements(player, next.requires)) {
      player.careerRank = rank + 1;
      player.notify();
    }
  }
}
