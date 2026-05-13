import { Scope, Scoped } from "di-wise";
import z from "zod";
import BaseRegistry from "./BaseRegistry.js";
import LevelCondition from "../../level/LevelCondition.js";

export interface LevelConditionEntry {
  ctor: new (...args: any[]) => LevelCondition;
  schema: z.ZodTypeAny;
}

@Scoped(Scope.Container)
export default class LevelConditionRegistry extends BaseRegistry<LevelConditionEntry> {}
