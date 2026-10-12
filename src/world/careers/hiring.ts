/**
 * What applying to and resigning from a job costs.
 *
 * Pure and React-free: given the work state, a career's terms and the current
 * year (the player's age), these decide whether an attempt is even allowed and
 * what it charges. The board renders the answer; `CareerSystem` applies it.
 *
 * Kept apart from `careerBoard.ts` on purpose — that module answers "do you
 * qualify", this one answers "can you afford it, and how long until you can
 * try again". The two refusals read differently to a player and are shown
 * differently.
 */

import { StatDelta, StatKey } from "../stats.js";
import type { CareerDefinition } from "./CareerDefinition.js";
import type { WorkState } from "./careerEngine.js";

/** Why an attempt is refused, as an i18n key (params resolved by the caller). */
export interface ApplyRefusal {
  key: string;
  params?: Record<string, string | number>;
}

/** The age at which `careerId` opens again, or `null` when it is open now. */
export function cooldownUntil(
  work: WorkState,
  careerId: string,
): number | null {
  const until = work.cooldowns?.[careerId];
  return until === undefined ? null : until;
}

/** Years still to wait on `careerId` at `now`, or 0 when it is open. */
export function cooldownRemaining(
  work: WorkState,
  careerId: string,
  now: number,
): number {
  const until = cooldownUntil(work, careerId);
  if (until === null) return 0;
  return Math.max(0, Math.ceil(until - now));
}

/**
 * The refusal for applying to `career`, or `null` when the attempt may proceed.
 *
 * Order matters: a job you are locked out of says so before it complains about
 * action points, because that is the fact the player needs first.
 */
export function attemptRefusal(
  career: CareerDefinition,
  work: WorkState,
  actionPoints: number,
  now: number,
): ApplyRefusal | null {
  const years = cooldownRemaining(work, career.id, now);
  if (years > 0) {
    return { key: "career.err.cooldown", params: { n: years } };
  }
  if (actionPoints < career.terms.applyAp) {
    return { key: "career.err.ap", params: { n: career.terms.applyAp } };
  }
  return null;
}

/** Stamp a career closed for `years` from `now`. Returns the new work state. */
export function startCooldown(
  work: WorkState,
  careerId: string,
  years: number,
  now: number,
): WorkState {
  if (years <= 0) return work;
  return {
    ...work,
    cooldowns: { ...work.cooldowns, [careerId]: now + years },
  };
}

/** What resigning from `career` costs in stats. */
export function resignCost(career: CareerDefinition): StatDelta {
  return { ...career.terms.resignCost };
}

/**
 * Scale a resignation penalty by how long the player actually stayed.
 *
 * Quitting in your first year forfeits the notice period and burns the bridge;
 * leaving after a long tenure is a normal career move and costs less. Returns
 * the adjusted delta plus the years the job stays closed.
 */
export function resignation(
  career: CareerDefinition,
  tenure: number,
): { cost: StatDelta; cooldown: number; halfNotice: boolean } {
  const halfNotice = tenure < 1;
  const cost: StatDelta = {};
  for (const [key, value] of Object.entries(career.terms.resignCost)) {
    if (typeof value !== "number") continue;
    // A short stay doubles a penalty and halves a bonus.
    const key0 = key as StatKey;
    cost[key0] = halfNotice
      ? value > 0
        ? Math.round(value / 2)
        : value * 2
      : value;
  }
  return {
    cost,
    cooldown: halfNotice
      ? career.terms.resignCooldown * 2
      : career.terms.resignCooldown,
    halfNotice,
  };
}
