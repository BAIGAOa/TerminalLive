import GeneralPurpose from "../worlds/conditions/GeneralPurpose.js";
import WorldCondition from "../worlds/WorldCondition.js";

/** Shared, React-free description of a level victory condition. Both the game
 * screen and the world-selection screen used to duplicate this logic. */

export type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type ConditionDescription =
  | { known: true; description: string }
  | { known: false; typeName: string };

/**
 * Describe a condition. A `GeneralPurpose` condition yields a ready-made
 * "prop > n" string; an unknown subclass yields its constructor name so each
 * caller can format it in its own way (e.g. bracketed vs. a translated
 * "custom condition" label).
 */
export function describeCondition(
  condition: WorldCondition,
  t: Translator,
): ConditionDescription {
  if (condition instanceof GeneralPurpose) {
    const propName = t(`playerConfig.attr.${condition.prop}`);
    const cmp = condition.cat === "greaterThan" ? ">" : "<";
    return { known: true, description: `${propName} ${cmp} ${condition.num}` };
  }
  const typeName = (condition as any).constructor?.name || "Unknown";
  return { known: false, typeName };
}
