import { Incident } from "../world/Incident.js";

export default interface FilterContext {
    incident: Incident;
    rangeKey: string;
    triggeredHistory: Set<string>;
    blockedHistory: Set<string>;
    rangeHistory: Map<string, Set<string>>;

}
