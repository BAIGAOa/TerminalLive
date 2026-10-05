import BaseRegistry from "../../core/registry/BaseRegistry.js";
import type { WorldRuleDef } from "./WorldRule.js";

/** Holds every world-rule definition (global; never reset per world). */
export default class WorldRuleRegistry extends BaseRegistry<WorldRuleDef> {}
