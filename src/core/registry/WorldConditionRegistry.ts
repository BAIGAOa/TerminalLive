import z from "zod";
import BaseRegistry from "./BaseRegistry.js";
import WorldCondition from "../../worlds/WorldCondition.js";

export interface WorldConditionEntry {
  ctor: new (...args: any[]) => WorldCondition;
  schema: z.ZodTypeAny;
}

export default class WorldConditionRegistry extends BaseRegistry<WorldConditionEntry> {}
