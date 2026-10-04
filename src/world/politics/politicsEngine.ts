/**
 * Pure faction-politics simulation. Factions hold power, relate to one another
 * (ally ↔ rival on a −100..100 axis) and collectively set a tension level that
 * produces policies and flashpoints. No container, no React — `PoliticsSystem`
 * is a thin shell over it, bridging to the world's standing and the economy.
 */

export type RelationKind = "ally" | "neutral" | "rival";

export interface FactionSim {
  id: string;
  power: number; // 0..100
  /** faction id → relation (-100..100). */
  relation: Record<string, number>;
}

export interface PoliticsState {
  factions: Record<string, FactionSim>;
  tension: number; // 0..100
  /** Active policy ids. */
  policies: string[];
  /** Faction the player has thrown in with. */
  playerLean: string | null;
}

export interface PolicyDef {
  id: string;
  labelKey: string;
  /** Yearly tilt applied to the market (-1..1 scale). */
  marketBias: number;
  tensionDelta: number;
  /** Public order contribution (0..100 scaler). */
  order: number;
}

export const POLICIES: PolicyDef[] = [
  { id: "policy_austerity", labelKey: "politics.policy.austerity", marketBias: -0.04, tensionDelta: 3, order: 6 },
  { id: "policy_stimulus", labelKey: "politics.policy.stimulus", marketBias: 0.05, tensionDelta: -2, order: -1 },
  { id: "policy_crackdown", labelKey: "politics.policy.crackdown", marketBias: -0.01, tensionDelta: 7, order: 10 },
  { id: "policy_reform", labelKey: "politics.policy.reform", marketBias: 0.02, tensionDelta: -4, order: 4 },
];

export interface PoliticsEvent {
  kind: string;
  params?: Record<string, number | string>;
}

export type Rng = () => number;

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export function emptyPolitics(
  factions: Array<{ id: string; rivals?: string[] }>,
): PoliticsState {
  const state: PoliticsState = {
    factions: {},
    tension: 30,
    policies: [],
    playerLean: null,
  };
  for (const f of factions) {
    state.factions[f.id] = { id: f.id, power: 50, relation: {} };
  }
  for (const a of factions) {
    for (const b of factions) {
      if (a.id === b.id) continue;
      const rival = (a.rivals ?? []).includes(b.id) || (b.rivals ?? []).includes(a.id);
      state.factions[a.id].relation[b.id] = rival ? -55 : 0;
    }
  }
  return state;
}

export function relationKind(v: number): RelationKind {
  if (v >= 30) return "ally";
  if (v <= -30) return "rival";
  return "neutral";
}

export function meanRelation(state: PoliticsState): number {
  const vals: number[] = [];
  const ids = Object.keys(state.factions);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      vals.push(state.factions[ids[i]].relation[ids[j]] ?? 0);
    }
  }
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

/** The strongest faction (its agenda dominates policy). */
export function dominantFaction(state: PoliticsState): string | null {
  let best: string | null = null;
  let bestPower = -1;
  for (const f of Object.values(state.factions)) {
    if (f.power > bestPower) {
      best = f.id;
      bestPower = f.power;
    }
  }
  return best;
}

/** How many factions the player is strongly aligned with (standing ≥ 40). */
export function alignedCount(standing: Record<string, number>): number {
  return Object.entries(standing).filter(([, v]) => v >= 40).length;
}

/**
 * One year of politics: powers and relations drift, tension follows the average
 * relation, and flashpoints (conflict/summit) and policy enactments fire.
 */
export function tickPolitics(
  state: PoliticsState,
  rng: Rng,
  playerStanding: Record<string, number> = {},
): PoliticsEvent[] {
  const events: PoliticsEvent[] = [];
  const ids = Object.keys(state.factions);

  for (const f of Object.values(state.factions)) {
    const drift = (rng() - 0.5) * 5;
    // Player backing (high standing) boosts a faction's power.
    const backing = state.playerLean === f.id ? 1.5 : 0;
    f.power = clamp(f.power + drift + backing, 0, 100);
  }

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = state.factions[ids[i]];
      const b = state.factions[ids[j]];
      const d = (rng() - 0.5) * 7;
      const next = clamp((a.relation[b.id] ?? 0) + d, -100, 100);
      a.relation[b.id] = next;
      b.relation[a.id] = next;
    }
  }

  // Tension tracks the (inverse) average relation.
  const target = clamp(50 - meanRelation(state) * 0.5, 0, 100);
  state.tension = clamp(state.tension + (target - state.tension) * 0.4);

  if (state.tension >= 75 && rng() < 0.25) {
    events.push({ kind: "politics.conflict" });
    // Conflict reshuffles power: strongest gains, weakest loses.
    const dom = dominantFaction(state);
    for (const f of Object.values(state.factions)) {
      f.power = clamp(f.power + (f.id === dom ? 4 : -3), 0, 100);
    }
    state.tension = clamp(state.tension - 6);
  } else if (state.tension <= 22 && rng() < 0.18) {
    events.push({ kind: "politics.summit" });
    state.tension = clamp(state.tension + 3);
  }

  // Policy adoption, gated by tension and how many are already active.
  if (state.policies.length < 3 && rng() < 0.16) {
    const available = POLICIES.filter((p) => !state.policies.includes(p.id));
    if (available.length > 0) {
      const pick = available[Math.floor(rng() * available.length)];
      state.policies.push(pick.id);
      state.tension = clamp(state.tension + pick.tensionDelta);
      events.push({ kind: "politics.policyEnacted", params: { id: pick.id } });
    }
  }

  if (state.playerLean && (playerStanding[state.playerLean] ?? 0) < 10) {
    // Backing a flagging faction is noticed.
    events.push({ kind: "politics.leanSlipping", params: { id: state.playerLean } });
  }

  return events;
}

/** Net market tilt from active policies + tension (feeds the economy). */
export function marketBiasOf(state: PoliticsState): number {
  const policyBias = state.policies.reduce((s, id) => {
    const p = POLICIES.find((x) => x.id === id);
    return s + (p?.marketBias ?? 0);
  }, 0);
  const tensionDrag = -(state.tension - 40) / 400; // ±0.1
  return clamp(policyBias + tensionDrag, -0.15, 0.15);
}

/** A 0..100 public-order index (higher = more stable). */
export function publicOrder(state: PoliticsState): number {
  const policyOrder = state.policies
    .map((id) => POLICIES.find((x) => x.id === id)?.order ?? 0)
    .reduce((s, v) => s + v, 0);
  return Math.round(clamp(70 - state.tension + policyOrder * 0.6, 0, 100));
}

export function setLean(state: PoliticsState, factionId: string | null): void {
  state.playerLean = factionId;
}
