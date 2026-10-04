import { StatDelta } from "../world/stats.js";
import { KarmaDelta } from "../world/chronicle/karma.js";
import LevelCondition from "./LevelCondition.js";

/** What completing an objective grants. Applied via applyEffectPayload. */
export interface ObjectiveReward {
  effects?: StatDelta;
  items?: string[];
  flag?: string;
  karma?: KarmaDelta;
}

/**
 * A goal within a level, beyond the pass conditions. Required objectives are
 * shown as milestones; optional ones are "medals" that grant a reward the first
 * time they are met and are remembered across lives.
 */
export interface LevelObjective {
  id: string;
  labelKey: string;
  optional: boolean;
  condition: LevelCondition;
  reward?: ObjectiveReward;
}
