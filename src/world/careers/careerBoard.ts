/**
 * The job board: what a player sees when they open the career picker.
 *
 * Pure and React-free — it turns a career roster plus a player into the exact
 * card list the UI draws, including *why* a job is out of reach. The modal is
 * then a thin renderer over this, which is what keeps the eligibility rules
 * unit-testable without rendering anything.
 */

import Player from "../Player.js";
import { Requirement, StatKey } from "../stats.js";
import type { CareerDefinition, CareerMechanic, CareerTerms } from "./CareerDefinition.js";
import type { WorkState } from "./careerEngine.js";
import { cooldownRemaining } from "./hiring.js";

/** Whether a job can be taken right now, and if not, why. */
export type CareerCardState =
  /** Every entry gate passes. */
  | "available"
  /** At least one entry gate fails. */
  | "locked"
  /** The player already holds this job. */
  | "current"
  /** The player holds a life-long post, so no other job may be taken. */
  | "sealed"
  /** Qualified, but a failed attempt or a past resignation still bars it. */
  | "cooling";

/** One entry gate, resolved against the player, for the "why not" list. */
export interface CareerGateStatus {
  /** The stat or relationship gated on. */
  key: StatKey | string;
  /** True when the gate is on an NPC relationship rather than a stat. */
  isNpc: boolean;
  /** The player's current value. */
  value: number;
  /** Lower bound (inclusive), when the gate has one. */
  gte?: number;
  /** Upper bound (inclusive), when the gate has one. */
  lte?: number;
  met: boolean;
}

/** A career as the board renders it. */
export interface CareerCard {
  id: string;
  labelKey: string;
  descKey: string;
  icon: string;
  fieldKey: string;
  state: CareerCardState;
  lucky: boolean;
  /** Number of rungs on the ladder. */
  ranks: number;
  /** Salary at the entry rung — what the card headlines. */
  entrySalary: number;
  /** Salary at the top rung. */
  topSalary: number;
  lifelong: boolean;
  mechanics: CareerMechanic[];
  /** What applying and resigning cost for this job. */
  terms: CareerTerms;
  /** Years still to wait before this job may be applied to again. */
  cooldownYears: number;
  /** Every entry gate with its resolution; empty for an ungated job. */
  gates: CareerGateStatus[];
  /** Just the failed gates, in the same order. */
  unmet: CareerGateStatus[];
}

/** Resolve a single requirement against the player. */
export function gateStatus(player: Player, req: Requirement): CareerGateStatus {
  const isNpc = req.npc !== undefined;
  const value = isNpc
    ? player.getRelationship(req.npc!)
    : req.prop !== undefined
      ? player.getStat(req.prop)
      : 0;
  let met = isNpc || req.prop !== undefined;
  if (met && req.gte !== undefined && value < req.gte) met = false;
  if (met && req.lte !== undefined && value > req.lte) met = false;
  return {
    key: (isNpc ? req.npc! : req.prop!) as StatKey | string,
    isNpc,
    value,
    gte: req.gte,
    lte: req.lte,
    met,
  };
}

/** Every gate on a career's own entry, resolved. */
export function entryGates(
  player: Player,
  career: CareerDefinition,
): CareerGateStatus[] {
  return career.entry.map((req) => gateStatus(player, req));
}

export function entryMet(player: Player, career: CareerDefinition): boolean {
  return career.entry.every((req) => gateStatus(player, req).met);
}

/** A player's position, as the board needs to read it. */
export interface BoardPlayer {
  careerId: string | null;
}

/**
 * The career the player is locked into forever, if any.
 *
 * A life-long post blocks every other job; nothing else does, so an ordinary
 * employee is free to move.
 */
export function sealedBy(
  held: CareerDefinition | undefined,
): CareerDefinition | undefined {
  return held?.lifelong ? held : undefined;
}

/** Build one card. `heldId` is the player's current job, if any. */
export function buildCard(
  player: Player,
  career: CareerDefinition,
  heldId: string | null,
  seal: CareerDefinition | undefined,
  work?: WorkState,
  now = 0,
): CareerCard {
  const gates = entryGates(player, career);
  const unmet = gates.filter((g) => !g.met);
  const cooldownYears = work ? cooldownRemaining(work, career.id, now) : 0;

  let state: CareerCardState = unmet.length === 0 ? "available" : "locked";
  // Being barred by a cooldown outranks a gate failure only in the sense that
  // the job is still out of reach either way; the card says the nearer reason.
  if (cooldownYears > 0 && state === "available") state = "cooling";
  if (seal && seal.id !== career.id) state = "sealed";
  if (career.id === heldId) state = "current";

  const entrySalary = career.ranks[0]?.salary ?? 0;
  const topSalary = career.ranks[career.ranks.length - 1]?.salary ?? 0;

  return {
    id: career.id,
    labelKey: career.labelKey,
    descKey: career.descKey,
    icon: career.icon,
    fieldKey: career.fieldKey,
    state,
    lucky: state === "available" && career.entry.length > 0,
    ranks: career.ranks.length,
    entrySalary,
    topSalary,
    lifelong: career.lifelong,
    mechanics: [...career.mechanics],
    terms: career.terms,
    cooldownYears,
    gates,
    unmet,
  };
}

/**
 * The full board, in the order the roster gives.
 *
 * The caller decides the ordering (the registry's), because a content pack may
 * want its jobs in a particular sequence and sorting here would override that.
 */
export function buildCareerBoard(
  player: Player,
  careers: readonly CareerDefinition[],
  work?: WorkState,
  now = 0,
): CareerCard[] {
  const heldId = player.careerId;
  const held = careers.find((c) => c.id === heldId);
  const seal = sealedBy(held);
  return careers.map((career) =>
    buildCard(player, career, heldId, seal, work, now),
  );
}

/** One rung of a ladder, resolved against the player, for the detail pane. */
export interface CareerRankView {
  titleKey: string;
  salary: number;
  /** How many of this rung's promotion gates the player already meets. */
  metCount: number;
  gateCount: number;
  met: boolean;
}

/** The whole ladder with each rung's promotion gates resolved. */
export function rankViews(
  player: Player,
  career: CareerDefinition,
): CareerRankView[] {
  return career.ranks.map((rank) => {
    const gates = rank.requires.map((req) => gateStatus(player, req));
    const metCount = gates.filter((g) => g.met).length;
    return {
      titleKey: rank.titleKey,
      salary: rank.salary,
      metCount,
      gateCount: gates.length,
      // The entry rung has no promotion gate, so it counts as reachable.
      met: gates.length === 0 || metCount === gates.length,
    };
  });
}

export interface BoardSummary {
  total: number;
  available: number;
  locked: number;
  /** Jobs ruled out because a life-long post is already held. */
  sealed: number;
  /** Qualified jobs still barred by a cooldown. */
  cooling: number;
}

export function summarizeBoard(cards: readonly CareerCard[]): BoardSummary {
  let available = 0;
  let locked = 0;
  let sealed = 0;
  let cooling = 0;
  for (const card of cards) {
    if (card.state === "available" || card.state === "current") available += 1;
    else if (card.state === "sealed") sealed += 1;
    else if (card.state === "cooling") cooling += 1;
    else locked += 1;
  }
  return { total: cards.length, available, locked, sealed, cooling };
}
