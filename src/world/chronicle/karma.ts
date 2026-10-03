/**
 * Karma — the moral ledger of a life. Every meaningful choice nudges one or
 * more axes; the dominant axis at the end names the person you became.
 */
export type KarmaAxis = "benevolence" | "ambition" | "wisdom" | "rebellion";

export const KARMA_AXES: KarmaAxis[] = [
  "benevolence",
  "ambition",
  "wisdom",
  "rebellion",
];

export type KarmaDelta = Partial<Record<KarmaAxis, number>>;

export type KarmaState = Record<KarmaAxis, number>;

export const KARMA_MIN = -100;
export const KARMA_MAX = 100;

function clamp(v: number): number {
  return Math.max(KARMA_MIN, Math.min(KARMA_MAX, v));
}

export function emptyKarma(): KarmaState {
  return { benevolence: 0, ambition: 0, wisdom: 0, rebellion: 0 };
}

export function applyKarma(state: KarmaState, delta: KarmaDelta): KarmaState {
  const out: KarmaState = { ...state };
  for (const axis of KARMA_AXES) {
    const d = delta[axis];
    if (typeof d === "number") out[axis] = clamp(out[axis] + d);
  }
  return out;
}

/** The axis with the largest absolute value (ties resolved by axis order). */
export function dominantAxis(
  state: KarmaState,
): { axis: KarmaAxis; value: number } {
  let axis: KarmaAxis = "benevolence";
  let value = state[axis];
  for (const a of KARMA_AXES) {
    if (Math.abs(state[a]) > Math.abs(value)) {
      axis = a;
      value = state[a];
    }
  }
  return { axis, value };
}

/** A translation key for the overall moral alignment, e.g. `karma.wisdom.pos`. */
export function alignmentKey(state: KarmaState): string {
  const { axis, value } = dominantAxis(state);
  if (value === 0) return "karma.neutral";
  return `karma.${axis}.${value > 0 ? "pos" : "neg"}`;
}

/** Sum of the positive karma (a rough "goodness" score for endings). */
export function karmaScore(state: KarmaState): number {
  return KARMA_AXES.reduce((s, a) => s + state[a], 0);
}
