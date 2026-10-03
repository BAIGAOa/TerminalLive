import { Incident } from "../world/Incident.js";
import type WorldState from "../world/chronicle/WorldState.js";
import type PressureState from "../world/pressures/PressureState.js";
import type WeatherState from "../world/weather/WeatherState.js";

export default interface FilterContext {
    incident: Incident;
    rangeKey: string;
    triggeredHistory: Set<string>;
    blockedHistory: Set<string>;
    rangeHistory: Map<string, Set<string>>;
    /** The living world, when available (for `worldGate` filtering). */
    world?: WorldState | null;
    /** The hidden-score web, when available (for `pressureGate` filtering). */
    pressures?: PressureState | null;
    /** The current weather, when available (for `weatherGate` filtering). */
    weather?: WeatherState | null;
}
