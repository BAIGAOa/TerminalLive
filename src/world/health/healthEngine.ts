/**
 * Pure health & psychology model. A life accrues chronic and mental conditions,
 * trauma, resilience and a sense of meaning; addictions rise and fade. The
 * engine turns a year of state into vitality drag, mood shifts and events. No
 * container, no React — `HealthSystem` is a thin shell over it.
 */

export type ConditionKind = "chronic" | "mental";

export interface ConditionDef {
  id: string;
  kind: ConditionKind;
  /** Severity gained per year (scaled down by fitness). */
  severityRate: number;
  /** Health drained per year at full severity. */
  vitalityDrag: number;
  /** Contribution to reduced life expectancy at full severity. */
  mortality: number;
}

export const CONDITIONS: ConditionDef[] = [
  { id: "cond_hypertension", kind: "chronic", severityRate: 0.5, vitalityDrag: 0.9, mortality: 3 },
  { id: "cond_diabetes", kind: "chronic", severityRate: 0.6, vitalityDrag: 1.2, mortality: 4 },
  { id: "cond_chronicPain", kind: "chronic", severityRate: 0.35, vitalityDrag: 0.8, mortality: 1.5 },
  { id: "cond_anxiety", kind: "mental", severityRate: 0.3, vitalityDrag: 0.2, mortality: 1 },
  { id: "cond_depression", kind: "mental", severityRate: 0.25, vitalityDrag: 0.3, mortality: 2 },
];

export const ADDICTIONS = [
  "add_alcohol",
  "add_smoke",
  "add_gambling",
] as const;
export type AddictionId = (typeof ADDICTIONS)[number];

export interface ConditionState {
  severity: number; // 0..100
  sinceAge: number;
}

export interface AddictionState {
  dependence: number; // 0..100
  tolerance: number; // 0..100
}

export interface HealthState {
  conditions: Record<string, ConditionState>;
  trauma: number; // 0..100
  resilience: number; // 0..100
  meaning: number; // 0..100
  addictions: Record<string, AddictionState>;
  /** Age of the last screening, so checkups aren't spammed. */
  checkupAge: number;
}

export interface HealthStats {
  age: number;
  fitness: number;
  social: number;
  happiness: number;
}

export interface HealthEvent {
  kind: string;
  params?: Record<string, number | string>;
}

export type Rng = () => number;

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export function emptyHealthState(): HealthState {
  return {
    conditions: {},
    trauma: 0,
    resilience: 40,
    meaning: 50,
    addictions: {},
    checkupAge: 0,
  };
}

export function conditionDef(id: string): ConditionDef | undefined {
  return CONDITIONS.find((c) => c.id === id);
}

export function acquireCondition(
  state: HealthState,
  id: string,
  age: number,
  severity = 20,
): boolean {
  if (state.conditions[id]) return false;
  state.conditions[id] = { severity: clamp(severity), sinceAge: age };
  return true;
}

/** Treatment lowers severity; removed once it bottoms out. */
export function treatCondition(state: HealthState, id: string, amount: number): boolean {
  const c = state.conditions[id];
  if (!c) return false;
  c.severity = clamp(c.severity - amount);
  if (c.severity <= 0) delete state.conditions[id];
  return true;
}

export function useAddiction(state: HealthState, id: string, amount = 10): void {
  const a = state.addictions[id] ?? { dependence: 0, tolerance: 0 };
  a.dependence = clamp(a.dependence + amount);
  a.tolerance = clamp(a.tolerance + amount * 0.6);
  state.addictions[id] = a;
}

export function tendAddiction(state: HealthState, id: string, amount: number): boolean {
  const a = state.addictions[id];
  if (!a) return false;
  a.dependence = clamp(a.dependence - amount);
  a.tolerance = clamp(a.tolerance - amount * 0.5);
  if (a.dependence <= 0) delete state.addictions[id];
  return true;
}

export function addTrauma(state: HealthState, amount: number): void {
  state.trauma = clamp(state.trauma + amount);
}

export function buildResilience(state: HealthState, amount: number): void {
  state.resilience = clamp(state.resilience + amount);
}

/**
 * One year of health: conditions progress, trauma heals or festers, meaning and
 * resilience drift, addictions recede. Returns vitality drag (health to drain),
 * a mood delta, and narration events.
 */
export function tickHealth(
  state: HealthState,
  stats: HealthStats,
  rng: Rng,
): { vitalityDrag: number; moodDelta: number; events: HealthEvent[] } {
  const events: HealthEvent[] = [];
  let vitalityDrag = 0;
  let moodDelta = 0;

  const fitnessGuard = 1 - clamp(stats.fitness, 0, 100) / 200; // 1.0 → 0.5

  for (const [id, c] of Object.entries(state.conditions)) {
    const def = conditionDef(id);
    if (!def) continue;
    c.severity = clamp(c.severity + def.severityRate * fitnessGuard - 0.1);
    if (c.severity > 0) {
      vitalityDrag += (def.vitalityDrag * c.severity) / 100;
      if (def.kind === "mental") moodDelta -= c.severity / 40;
      if (c.severity >= 85 && rng() < 0.12) {
        events.push({ kind: "health.crisis", params: { id } });
        vitalityDrag += 3;
      }
    }
    if (c.severity <= 0) delete state.conditions[id];
  }

  // Trauma festers without resilience, and slowly heals with it.
  if (state.trauma > 0) {
    const heal = state.resilience / 60 + stats.social / 200;
    state.trauma = clamp(state.trauma - heal);
    if (state.trauma > 60 && rng() < 0.15) {
      events.push({ kind: "health.flashback" });
      moodDelta -= 2;
    }
  }

  // Meaning drifts toward fulfilment from social ties & happiness.
  const meaningPull = (stats.social + stats.happiness - 100) / 50;
  state.meaning = clamp(state.meaning + meaningPull - (state.trauma > 40 ? 1 : 0));
  if (state.meaning < 20 && rng() < 0.1) events.push({ kind: "health.meaningless" });

  // Resilience grows with age a touch (coping), capped.
  state.resilience = clamp(state.resilience + 0.4);

  // Addictions slowly recede when not fed, but tolerance lingers.
  for (const [id, a] of Object.entries(state.addictions)) {
    a.dependence = clamp(a.dependence - 2);
    a.tolerance = clamp(a.tolerance - 1);
    if (a.dependence > 70 && rng() < 0.1) {
      events.push({ kind: "health.withdrawal", params: { id } });
      vitalityDrag += 0.6;
      moodDelta -= 2;
    }
    if (a.dependence <= 0) delete state.addictions[id];
  }

  // Acquiring new conditions as the body ages.
  if (stats.age >= 35 && rng() < 0.03 + (stats.age - 35) * 0.004) {
    const candidates = CONDITIONS.filter(
      (c) => !state.conditions[c.id] && c.kind === "chronic",
    );
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(rng() * candidates.length)];
      acquireCondition(state, pick.id, stats.age, 15);
      events.push({ kind: "health.diagnosed", params: { id: pick.id } });
    }
  }
  if (state.trauma > 50 && !state.conditions.cond_depression && rng() < 0.08) {
    acquireCondition(state, "cond_depression", stats.age, 15);
    events.push({ kind: "health.diagnosed", params: { id: "cond_depression" } });
  }

  return { vitalityDrag, moodDelta, events };
}

/** Derived life expectancy, pulled down by severe conditions and trauma. */
export function lifeExpectancy(state: HealthState, stats: HealthStats): number {
  let years = 78 + stats.fitness / 8;
  for (const [id, c] of Object.entries(state.conditions)) {
    const def = conditionDef(id);
    if (def) years -= (def.mortality * c.severity) / 100;
  }
  years -= state.trauma / 15;
  years -= Object.values(state.addictions).reduce((s, a) => s + a.dependence / 30, 0);
  years += (state.resilience - 40) / 20;
  return Math.max(30, Math.round(years));
}

/** A rough "wellbeing" index for summary screens. */
export function wellbeing(state: HealthState): number {
  const condLoad = Object.values(state.conditions).reduce((s, c) => s + c.severity, 0) / 5;
  return Math.round(
    clamp(state.meaning * 0.4 + state.resilience * 0.3 - state.trauma * 0.3 - condLoad),
  );
}
