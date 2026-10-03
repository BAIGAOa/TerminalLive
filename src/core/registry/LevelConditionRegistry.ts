import z from "zod";
import BaseRegistry from "./BaseRegistry.js";
import LevelCondition from "../../level/LevelCondition.js";

export interface LevelConditionEntry {
  ctor: new (...args: any[]) => LevelCondition;
  schema: z.ZodTypeAny;
}

export default class LevelConditionRegistry extends BaseRegistry<LevelConditionEntry> {}
