/**
 * Pure career/work simulation. No container, no React: given a `WorkState` and a
 * snapshot of the player's stats, these functions advance performance, burnout,
 * skills, office politics and a self-run venture. The UI and the container
 * singleton (`CareerSystem`) are thin layers over this.
 */

export const WORK_SKILLS = ["craft", "lead", "network", "finance"] as const;
export type WorkSkillId = (typeof WORK_SKILLS)[number];

export interface VentureState {
  industry: string;
  capital: number;
  staff: number;
  product: number; // 0..100 quality
  revenue: number; // paid last year
  risk: number; // 0..100
}

export interface WorkState {
  careerId: string | null;
  rank: number;
  /** Years at the current job. */
  tenure: number;
  performance: number; // 0..100
  burnout: number; // 0..100
  skills: Record<string, number>; // skillId → level (0..10)
  certs: string[];
  /** Office faction → standing (-100..100). */
  standing: Record<string, number>;
  venture: VentureState | null;
}

/** Minimal player view the engine needs (kept plain so tests avoid the Player). */
export interface WorkStats {
  intelligence: number;
  social: number;
  fitness: number;
  health: number;
  happiness: number;
  age: number;
}

export interface WorkEvent {
  kind: string;
  params?: Record<string, number | string>;
}

export type Rng = () => number;

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export function emptyWorkState(): WorkState {
  return {
    careerId: null,
    rank: 0,
    tenure: 0,
    performance: 40,
    burnout: 0,
    skills: { craft: 0, lead: 0, network: 0, finance: 0 },
    certs: [],
    standing: { peers: 0, bosses: 0, rivals: 0 },
    venture: null,
  };
}

export function skillTotal(state: WorkState): number {
  return Object.values(state.skills).reduce((s, v) => s + v, 0);
}

export function gainSkill(state: WorkState, id: WorkSkillId, amount: number): void {
  state.skills[id] = clamp((state.skills[id] ?? 0) + amount, 0, 10);
}

export function hasCert(state: WorkState, id: string): boolean {
  return state.certs.includes(id);
}

export function addCert(state: WorkState, id: string): boolean {
  if (hasCert(state, id)) return false;
  state.certs.push(id);
  state.performance = clamp(state.performance + 5);
  return true;
}

// ── player-driven work actions (AP-priced elsewhere) ────────────────
export type WorkActionId =
  | "work_overtime"
  | "work_learn"
  | "work_network"
  | "work_certify"
  | "work_rest";

export function workAction(state: WorkState, id: WorkActionId): WorkEvent[] {
  switch (id) {
    case "work_overtime":
      state.performance = clamp(state.performance + 9);
      state.burnout = clamp(state.burnout + 12);
      return [{ kind: "work.overtime" }];
    case "work_learn":
      gainSkill(state, "craft", 2);
      state.burnout = clamp(state.burnout + 3);
      return [{ kind: "work.learn" }];
    case "work_network":
      state.standing.peers = clamp(state.standing.peers + 6, -100, 100);
      state.performance = clamp(state.performance + 2);
      return [{ kind: "work.network" }];
    case "work_certify":
      if (state.skills.craft >= 4 && !hasCert(state, "cert_core")) {
        addCert(state, "cert_core");
        return [{ kind: "work.certified", params: { cert: "cert_core" } }];
      }
      return [{ kind: "work.certFail" }];
    case "work_rest":
      state.burnout = clamp(state.burnout - 16);
      state.performance = clamp(state.performance + 2);
      return [{ kind: "work.rest" }];
    default:
      return [];
  }
}

// ── the yearly tick ─────────────────────────────────────────────────

/** Promotion gates beyond the role's own `requires`. */
export interface PromotionGate {
  performance: number;
  skill: number;
}

export function promotionGate(rank: number): PromotionGate {
  return { performance: 45 + rank * 8, skill: 2 + rank * 2 };
}

/** Whether the soft gates (independent of the role's stat requirements) pass. */
export function gateSatisfied(state: WorkState, gate: PromotionGate): boolean {
  const leadership = (state.skills.lead ?? 0) + (state.skills.craft ?? 0);
  return (
    state.performance >= gate.performance &&
    state.burnout < 80 &&
    leadership >= gate.skill &&
    (state.standing.bosses ?? 0) > -30
  );
}

/**
 * Advance a year of work: drift performance from skills vs. burnout, accrue
 * burnout, and raise warnings when it gets severe. Returns narration events.
 */
export function tickWork(state: WorkState, stats: WorkStats, rng: Rng): WorkEvent[] {
  const events: WorkEvent[] = [];
  state.tenure += 1;

  const skillPull = skillTotal(state) * 0.25;
  const fitPull = (stats.fitness - 50) * 0.05;
  state.performance = clamp(
    state.performance + 1 + skillPull + fitPull - state.burnout * 0.12 + (rng() - 0.5) * 6,
  );
  state.burnout = clamp(
    state.burnout + 3 - (stats.fitness - 40) * 0.08 + (stats.age > 50 ? 1 : 0),
  );

  // Office politics drift: networking-heavy people accumulate standing.
  state.standing.peers = clamp(
    (state.standing.peers ?? 0) + (state.skills.network ?? 0) * 0.5 - 1,
    -100,
    100,
  );
  state.standing.rivals = clamp(
    (state.standing.rivals ?? 0) + (state.performance > 70 ? 1 : 0) - 0.5,
    -100,
    100,
  );

  if (state.burnout >= 80) events.push({ kind: "work.burnout" });
  if (state.performance < 20 && rng() < 0.35) {
    events.push({ kind: "work.warned" });
  }
  return events;
}

/** Try to promote within a ladder of `maxRank` steps; returns true if it rose. */
export function tryPromote(
  state: WorkState,
  maxRank: number,
  rankRequiresMet: boolean,
): boolean {
  if (!rankRequiresMet) return false;
  if (state.rank >= maxRank - 1) return false;
  if (!gateSatisfied(state, promotionGate(state.rank))) return false;
  state.rank += 1;
  state.tenure = 0;
  state.performance = clamp(state.performance - 10); // new rung, prove again
  return true;
}

// ── entrepreneurship ────────────────────────────────────────────────
export function startVenture(
  state: WorkState,
  industry: string,
  capital: number,
): WorkEvent[] {
  if (capital < 100) return [{ kind: "venture.tooPoor" }];
  state.venture = {
    industry,
    capital,
    staff: 0,
    product: 30,
    revenue: 0,
    risk: 30,
  };
  return [{ kind: "venture.started", params: { industry } }];
}

export interface VentureTick {
  revenue: number;
  bankrupt: boolean;
  events: WorkEvent[];
}

/**
 * One year of running a business: revenue scales with product/staff, then the
 * capital pool moves; a bad roll (competitor, lawsuit, downturn) raises risk and
 * burns capital; running out of capital ends the venture.
 */
export function tickVenture(venture: VentureState, rng: Rng): VentureTick {
  const events: WorkEvent[] = [];
  const quality = venture.product / 100;
  const staffPull = 1 + venture.staff * 0.15;
  let revenue = Math.round(quality * staffPull * (30 + venture.capital * 0.05));

  if (rng() < venture.risk / 400) {
    const trouble = 1 + rng() * 2;
    venture.capital -= Math.round(20 * trouble);
    venture.product = clamp(venture.product - 8 * trouble);
    venture.risk = clamp(venture.risk + 10);
    events.push({ kind: "venture.trouble" });
  } else {
    // Reinvest some profit into product; the rest is capital.
    venture.product = clamp(venture.product + 4);
    venture.risk = clamp(venture.risk - 3);
  }

  venture.capital += revenue - venture.staff * 12;
  venture.revenue = revenue;

  if (venture.capital <= 0) {
    events.push({ kind: "venture.bankrupt" });
    return { revenue, bankrupt: true, events };
  }
  if (revenue > venture.staff * 12 * 3) events.push({ kind: "venture.profit" });
  return { revenue, bankrupt: false, events };
}
