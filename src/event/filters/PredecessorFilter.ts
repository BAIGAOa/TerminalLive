import FilterContext from "../FilterContext.js";
import IncidentFilter from "../IncidentFilter.js";

export default class PredecessorFilter implements IncidentFilter {
    public isEligible(context: FilterContext): boolean {
        const pre = context.incident.predecessorEvent
        if (!pre) return true
        return context.triggeredHistory.has(pre)
    }
}
