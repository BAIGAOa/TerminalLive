/**
 * Cross-stat couplings — how the player's numbers pull on each other.
 *
 * Pure and React-free, like `careerEngine` and `healthEngine`: given a snapshot
 * of the player and what the world knows about them, it returns the year's
 * consequences. `VitalsSystem` applies them.
 *
 * The rules are a table rather than a pile of `if`s, because the interesting
 * question in a life sim is never "what does depression do" but "what does
 * depression do *to* your health, your work, your face, and your drinking" —
 * and that is a matrix, not a branch. Each entry states its causal claim in
 * `note`, so the table doubles as the design document.
 *
 * Two rules of the table:
 *
 * 1. **Nothing here is unbounded.** `height`, `weight` and `money` are not
 *    gauges (`stats.ts` clamps them only at zero), so body rules compute the
 *    *target* and derive the delta from it, which keeps them inside their band
 *    no matter where they start.
 * 2. **Nothing here is a death spiral on its own.** Bumps are small and paired
 *    with a release, so the equilibrium is a life with a shape, not a collapse.
 */

import { type StatDelta } from "./stats.js";

/** Everything the rules may read. Assembled by `VitalsSystem`. */
export interface VitalsContext {
  age: number;
  health: number;
  height: number;
  weight: number;
  intelligence: number;
  social: number;
  fitness: number;
  happiness: number;
  reputation: number;
  appearance: number;
  angerValue: number;
  excitationValue: number;
  depressionValue: number;
  weakValue: number;
  money: number;
  /** Condition ids the player currently carries. */
  conditions: ReadonlySet<string>;
  /** Addiction ids the player currently carries. */
  addictions: ReadonlySet<string>;
  /** Whether the player has at least one tie worth the name. */
  bonded: boolean;
  /** Whether the player currently holds a job. */
  employed: boolean;
  /** Whether the player is married or partnered. */
  partnered: boolean;
}

export interface Coupling {
  id: string;
  /** The causal claim, in one line. Read by humans, not by the engine. */
  note: string;
  when: (c: VitalsContext) => boolean;
  /** Stat movement. Small numbers on purpose — a year, not an era. */
  then: StatDelta;
  /** Probability of firing when `when` holds. Default 1 (always). */
  chance?: number;
  /** Condition to diagnose when it fires. */
  acquire?: string;
  /** Addiction to start feeding when it fires. */
  indulge?: string;
  /** Addiction to start tending when it fires. */
  tend?: string;
}

// ── bands ────────────────────────────────────────────────────────────
/** Body limits. `height`/`weight` are clamps we own — `stats.ts` only floors them. */
export const HEIGHT_MIN = 1.2;
export const HEIGHT_MAX = 2.05;
export const WEIGHT_MIN = 35;
export const WEIGHT_MAX = 150;

/** Growth stops here; after it, height only ever compresses. */
const GROWTH_ENDS = 18;
/** Metabolism starts losing ground here unless fitness holds it back. */
const METABOLISM_TURNS = 35;
/** Faces start showing it here, faster if the body is unwell. */
const AGEING_STARTS = 45;
/** The spine gives up a little, eventually. */
const COMPRESSION_STARTS = 70;

/** Body-mass index band. Below/above, the body starts charging for it. */
export const BMI_LOW = 17.5;
export const BMI_HIGH = 27;

/** The low-mood band. Below it, despair accumulates; above, it recedes. */
const MOOD_FLOOR = 45;
const MOOD_RELIEF = 55;

export function bmi(height: number, weight: number): number {
  const h = Math.max(0.5, height);
  return weight / (h * h);
}

/** Decimals the body readings are shown to: centimetres and a tenth of a kilo. */
export const HEIGHT_DECIMALS = 2;
export const WEIGHT_DECIMALS = 1;

/**
 * Height in metres, to the centimetre.
 *
 * These two drift by fractions of a unit a year, so the stored value is a long
 * float — `1.8000000000000003`, `70.10000000000001` — and printing it raw puts
 * the arithmetic on screen. Formatting lives here, next to the model that
 * produces the numbers, so the sheet, the config editor and the dev harness all
 * round the same way.
 */
export function formatHeight(metres: number): string {
  return metres.toFixed(HEIGHT_DECIMALS);
}

/** Weight in kilograms, to a tenth. */
export function formatWeight(kg: number): string {
  return kg.toFixed(WEIGHT_DECIMALS);
}

/**
 * One attribute, as a list should show it.
 *
 * Only the two body readings need rounding, but the attribute editor walks a
 * generic key list and cannot special-case them itself.
 */
export function bodyText(key: string, value: unknown): string {
  if (typeof value === "number") {
    if (key === "height") return formatHeight(value);
    if (key === "weight") return formatWeight(value);
  }
  return String(value ?? "");
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── the table ────────────────────────────────────────────────────────
/**
 * The game's own rules. Mods add to them through `ctx.addCoupling` rather than
 * editing this — see `CouplingRegistry`.
 */
export const BASE_COUPLINGS: readonly Coupling[] = [
  // ── the body pays for how it is kept ───────────────────────────────
  // (Growth, metabolism, compression and the pace of ageing live in
  // `driftBody` instead: they need band clamps and arithmetic, not a flat
  // delta. Everything below is a claim that fits the table's shape.)
  {
    id: "unwell_face",
    note: "Chronic poor health shows on the face.",
    when: (c) => c.health < 40,
    then: { appearance: -0.5 },
  },
  {
    id: "despair_face",
    note: "So does long despair.",
    when: (c) => c.depressionValue >= 60,
    then: { appearance: -1 },
  },
  {
    id: "vigour_face",
    note: "Being fit and well in middle age keeps the face for longer.",
    when: (c) => c.age >= AGEING_STARTS && c.fitness >= 70 && c.health >= 70,
    then: { appearance: 0.5 },
  },

  // ── the body charges for its shape ─────────────────────────────────
  {
    id: "overweight",
    note: "Carrying too much weight costs fitness and health.",
    when: (c) => c.age >= GROWTH_ENDS && bmi(c.height, c.weight) > BMI_HIGH,
    then: { fitness: -0.5, health: -0.5 },
  },
  {
    id: "underweight",
    note: "So does carrying too little — but only an adult, since a growing child is meant to be light for its height.",
    when: (c) => c.age >= GROWTH_ENDS && bmi(c.height, c.weight) < BMI_LOW,
    then: { health: -0.5, fitness: -0.5 },
  },

  // ── mood moves mood ────────────────────────────────────────────────
  {
    id: "misery_accumulates",
    note: "An unhappy year deepens despair. (Nothing used to happen below 55.)",
    when: (c) => c.happiness < MOOD_FLOOR,
    then: { depressionValue: 2 },
  },
  {
    id: "contentment_eases",
    note: "A happy year lets despair recede. Moved here from Player.tickYear, which held this half of the pair on its own.",
    when: (c) => c.happiness >= MOOD_RELIEF,
    then: { depressionValue: -2 },
  },
  {
    id: "solitude",
    note: "Little company and nobody close is its own slow poison.",
    when: (c) => c.social < 30 && !c.bonded,
    then: { depressionValue: 2, happiness: -1 },
  },
  {
    id: "company_feeds",
    note: "A sociable year is worth something on its own.",
    when: (c) => c.social >= 60,
    then: { happiness: 1 },
  },
  {
    id: "poverty_press",
    note: "Being broke as an adult wears a person down.",
    when: (c) => c.money < 50 && c.age >= 25,
    then: { happiness: -1, depressionValue: 1 },
  },

  // ── the body wears out ─────────────────────────────────────────────
  // Nothing here is a disease; it is just time. `lifeExpectancy()` has been
  // computed and shown to the player since the game began and has been enforced
  // by *nothing* — a life only ended if something else killed it first, which is
  // why most of the population reached the century mark. Banded rather than
  // continuous so each step reads as its own claim, and so the table stays a
  // table.
  {
    id: "aging_55",
    note: "Middle age: the body starts needing maintenance it never needed.",
    when: (c) => c.age >= 55,
    then: { health: -0.4 },
  },
  {
    id: "aging_65",
    note: "Old age: decline accelerates and recovery slows.",
    when: (c) => c.age >= 65,
    then: { health: -1 },
  },
  {
    id: "aging_75",
    note: "Late life: losing ground faster than it can be made up.",
    when: (c) => c.age >= 75,
    then: { health: -1.8 },
  },
  {
    id: "aging_85",
    note: "Extreme old age: something is always failing.",
    when: (c) => c.age >= 85,
    then: { health: -3 },
  },

  // ── the mind writes itself on the body ─────────────────────────────
  {
    id: "despair_somatic",
    note: "Sustained despair makes the body ill.",
    when: (c) => c.depressionValue >= 50,
    then: { health: -1, fitness: -1 },
  },
  {
    id: "rage_erodes",
    note: "A temper wears the people around you down.",
    when: (c) => c.angerValue >= 50,
    then: { social: -1, happiness: -1 },
  },
  {
    id: "mania_burns",
    note: "The crash after a long high.",
    when: (c) => c.excitationValue >= 60,
    then: { health: -1, weakValue: 1 },
  },
  {
    id: "exhaustion_drags",
    note: "Running on empty costs condition.",
    when: (c) => c.weakValue >= 50,
    then: { fitness: -1 },
  },
  {
    id: "age_blunts",
    note: "The mind loses a step or two, late.",
    when: (c) => c.age >= 65,
    then: { intelligence: -0.5 },
  },

  // ── the mind gets a diagnosis, and a drink ─────────────────────────
  {
    id: "clinical_despair",
    note: "Despair that will not lift stops being a mood and becomes an illness.",
    when: (c) => c.depressionValue >= 70 && !c.conditions.has("cond_depression"),
    then: {},
    acquire: "cond_depression",
  },
  {
    id: "chronic_dread",
    note: "A long run of anger and agitation calcifies into anxiety.",
    when: (c) =>
      (c.angerValue >= 60 || c.excitationValue >= 60) &&
      !c.conditions.has("cond_anxiety"),
    then: {},
    chance: 0.5,
    acquire: "cond_anxiety",
  },
  {
    id: "self_medicating",
    note: "Miserable and worn down, a person reaches for something.",
    when: (c) =>
      c.depressionValue >= 55 && c.happiness < 40 && !c.addictions.has("add_alcohol"),
    then: { happiness: 1 },
    chance: 0.18,
    indulge: "add_alcohol",
  },
  {
    id: "reaching_out",
    note: "With enough resilience, the same misery is what makes someone ask for help.",
    when: (c) =>
      c.depressionValue >= 55 && c.addictions.has("add_alcohol"),
    then: {},
    chance: 0.25,
    tend: "add_alcohol",
  },

  // ── work charges for the body it borrows ───────────────────────────
  {
    id: "burnout_bites",
    note: "Chronic depletion does not stay at work — it follows you home.",
    when: (c) => c.employed && c.weakValue >= 60,
    then: { happiness: -1 },
  },
];

// ── evaluation ───────────────────────────────────────────────────────

export interface VitalsOutcome {
  /** Combined stat movement for the year. */
  delta: StatDelta;
  /** Conditions the year argues for. */
  acquire: string[];
  /** Addictions to start feeding. */
  indulge: string[];
  /** Addictions to start tending. */
  tend: string[];
  /** Ids of the couplings that fired, in table order. */
  fired: string[];
}

/**
 * Accumulate one contribution.
 *
 * Deliberately unrounded while accumulating — rounding each step is how a slow
 * drift (a few millimetres a year) gets rounded away to nothing. The result is
 * tidied once, at the end.
 */
function add(delta: StatDelta, key: keyof StatDelta, value: number): void {
  if (!value) return;
  delta[key] = (delta[key] ?? 0) + value;
}

/** Drop the zeros and the float dust, so the returned delta reads cleanly. */
function tidy(delta: StatDelta): StatDelta {
  const out: StatDelta = {};
  for (const [k, v] of Object.entries(delta)) {
    const rounded = Math.round((v as number) * 1000) / 1000;
    if (rounded) out[k as keyof StatDelta] = rounded;
  }
  return out;
}

/**
 * The body-mass index a growing child is held near.
 *
 * Without this, a child gets taller at a constant weight, which is not a child
 * — it is a starvation case, and the BMI rules below then charge for it every
 * single year. Growth has to add mass.
 */
const CHILD_BMI = 19;

/**
 * Body drift, kept separate because it is arithmetic rather than a claim about
 * people: growth, metabolism and ageing, each clamped into its band.
 */
export function driftBody(c: VitalsContext): StatDelta {
  const delta: StatDelta = {};

  // Height first, and clamped before anything reads it: the weight band is
  // measured against height, so a height outside its band (a hand-edited save,
  // a world that starts you at 0) would collapse the weight band to nothing and
  // leave the body with nowhere to be pulled back to.
  let height = c.height;
  if (c.age < GROWTH_ENDS) {
    // Tapered: the last years before the growth plates close add little.
    height += 0.03 * (1 - c.age / GROWTH_ENDS);
  } else if (c.age >= COMPRESSION_STARTS) {
    height -= 0.004;
  }
  height = clamp(height, HEIGHT_MIN, HEIGHT_MAX);
  add(delta, "height", height - c.height);

  // Weight is a single synthesis, not several deltas summed. Each rule used to
  // compute its own change against the *original* weight and the results were
  // added together, so a child who was overweight was pulled toward a child's
  // build and toward the adult band at once and overshot straight through the
  // floor. One pass, one clamp at the end, is the only version that holds.
  const gap = height * height;
  let weight = c.weight;

  if (c.age < GROWTH_ENDS) {
    // A growing body gains mass *with* its height, holding a child's build.
    // A quarter of the way each year, not all of it: growing is gradual.
    weight += (CHILD_BMI * gap - weight) * 0.25;
  } else if (c.age >= COMPRESSION_STARTS) {
    weight -= 0.3;
  } else if (c.age >= METABOLISM_TURNS) {
    // Fitness is the counterweight: a fit body holds its weight.
    weight += 0.4 - c.fitness / 250;
  }

  // Homeostasis, at every age: a body outside its band is pulled back toward
  // the edge. Without it the band is only a penalty line — someone who ended up
  // outside it would stay there forever, and it would not be an invariant.
  const under = BMI_LOW * gap;
  const over = BMI_HIGH * gap;
  if (weight < under) weight += (under - weight) * 0.2;
  else if (weight > over) weight -= (weight - over) * 0.2;

  weight = clamp(weight, WEIGHT_MIN, WEIGHT_MAX);
  add(delta, "weight", weight - c.weight);

  if (c.age >= AGEING_STARTS) {
    // How fast the face goes depends on how well the body is held together.
    const drag = 0.6 * (1 - (c.health + c.happiness) / 300);
    add(delta, "appearance", -Math.max(0, drag));
  }

  return tidy(delta);
}

/**
 * Run the table. A coupling with `chance` draws from `rng`; pass `() => 0` to
 * make every probabilistic rule fire, which is what the tests do.
 *
 * `extra` is the plugins' contribution — appended after the base table, so a
 * mod can add a consequence but never replace one of the game's own rules out
 * from under it.
 */
export function evaluateVitals(
  ctx: VitalsContext,
  rng: () => number,
  extra: readonly Coupling[] = [],
): VitalsOutcome {
  const delta = driftBody(ctx);
  const acquire: string[] = [];
  const indulge: string[] = [];
  const tend: string[] = [];
  const fired: string[] = [];

  const rules = extra.length > 0 ? [...BASE_COUPLINGS, ...extra] : BASE_COUPLINGS;
  for (const rule of rules) {
    if (!rule.when(ctx)) continue;
    if (rule.chance !== undefined && rng() >= rule.chance) continue;
    fired.push(rule.id);
    for (const [key, value] of Object.entries(rule.then)) {
      add(delta, key as keyof StatDelta, value as number);
    }
    if (rule.acquire) acquire.push(rule.acquire);
    if (rule.indulge) indulge.push(rule.indulge);
    if (rule.tend) tend.push(rule.tend);
  }

  return { delta: tidy(delta), acquire, indulge, tend, fired };
}
