import IncidentFilter from "../../event/IncidentFilter.js";
import FilterContext from "../../event/FilterContext.js";
import WorldState from "./WorldState.js";

/** A gate on the world state an event may require to be eligible. */
export interface WorldGate {
  /** Only in this era. */
  era?: string;
  /** Only in this region. */
  region?: string;
  /** Requires at least `minStanding` (default 1) with this faction. */
  faction?: string;
  minStanding?: number;
}

export function meetsWorldGate(gate: WorldGate, world: WorldState): boolean {
  if (gate.era && world.eraId !== gate.era) return false;
  if (gate.region && world.regionId !== gate.region) return false;
  if (gate.faction) {
    const min = gate.minStanding ?? 1;
    if ((world.standing.get(gate.faction) ?? 0) < min) return false;
  }
  return true;
}

/** Event filter: drops incidents whose `worldGate` the world does not satisfy. */
export default class WorldFilter implements IncidentFilter {
  public isEligible(context: FilterContext): boolean {
    const gate = context.incident.worldGate;
    if (!gate || !context.world) return true;
    return meetsWorldGate(gate, context.world);
  }
}
