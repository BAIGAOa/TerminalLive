import FilterContext from "../FilterContext.js";
import IncidentFilter from "../IncidentFilter.js";

export default class BlockedFilter implements IncidentFilter {
    public isEligible(context: FilterContext): boolean {
        return !context.blockedHistory.has(context.incident.id)
    }
}
