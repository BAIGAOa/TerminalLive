import BaseRegistry from "./BaseRegistry.js";
import type { Coupling } from "../../world/vitalsEngine.js";

/**
 * Coupling rules contributed by plugins and mods.
 *
 * The game's own table lives in `vitalsEngine` and is a compile-time constant;
 * this holds only what plugins add, so unloading one takes its rules with it and
 * a hot reload cannot stack duplicates. `VitalsSystem` evaluates the two
 * together, base first.
 *
 * Keyed by the rule's own `id`, which is also what shows up in the balance
 * harness's `[couplings / life]` output — so a mod that over-fires is visible
 * in the same table as everything else.
 */
export default class CouplingRegistry extends BaseRegistry<Coupling> {
  /** Register by the rule's own id. Throws on a duplicate, like boot content. */
  public addRule(rule: Coupling): void {
    this.register(rule.id, rule);
  }

  /** Every plugin rule, in load order. */
  public rules(): Coupling[] {
    return this.getAll();
  }
}
