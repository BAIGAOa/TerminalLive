import IncidentFilter from "../../event/IncidentFilter.js";
import FilterContext from "../../event/FilterContext.js";
import PressureState from "./PressureState.js";

/** A hard gate on a hidden-score axis an event may require. */
export interface PressureGate {
  axis: string;
  gte?: number;
  lte?: number;
}

/** A soft multiplier applied to an event's weight when an axis is in a band. */
export interface PressureBias {
  axis: string;
  factor: number;
  gte?: number;
  lte?: number;
}

export function meetsPressureGate(
  gate: PressureGate,
  pressures: PressureState,
): boolean {
  const v = pressures.get(gate.axis);
  if (gate.gte !== undefined && v < gate.gte) return false;
  if (gate.lte !== undefined && v > gate.lte) return false;
  return true;
}

/** Product of every satisfied bias factor (1 when none apply). */
export function pressureBiasFactor(
  bias: PressureBias[] | null | undefined,
  pressures: PressureState | null,
): number {
  if (!bias || !pressures) return 1;
  let factor = 1;
  for (const b of bias) {
    const v = pressures.get(b.axis);
    if (b.gte !== undefined && v < b.gte) continue;
    if (b.lte !== undefined && v > b.lte) continue;
    factor *= b.factor;
  }
  return factor;
}

/** Event filter: drops incidents whose `pressureGate` is unmet. */
export default class PressureFilter implements IncidentFilter {
  public isEligible(context: FilterContext): boolean {
    const gate = context.incident.pressureGate;
    if (!gate || !context.pressures) return true;
    return meetsPressureGate(gate, context.pressures);
  }
}
