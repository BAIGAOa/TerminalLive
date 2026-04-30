import FilterContext from "../FilterContext.js";
import IncidentFilter from "../IncidentFilter.js";

export default class OnceFilter implements IncidentFilter {
    public isEligible(context: FilterContext): boolean {
        const { incident, rangeKey, triggeredHistory, rangeHistory } = context

        if (rangeKey === 'post') {
            return !triggeredHistory.has(incident.id)
        }

        if (incident.once === true) {
            return !triggeredHistory.has(incident.id)
        }

        if (Array.isArray(incident.once)) {
            if (incident.once.includes(rangeKey)) {
                const triggeredRanges = rangeHistory.get(incident.id)
                return !(triggeredRanges && triggeredRanges.has(rangeKey))
            }
        }

        return true
    }
}
