import FilterContext from "../FilterContext.js";
import IncidentFilter from "../IncidentFilter.js";

export default class OnceFilter implements IncidentFilter {
    public isEligible(context: FilterContext): boolean {
        const { incident, rangeKey, triggeredHistory, rangeHistory } = context

        // NOTE: post-event targets are NOT blanket once-only. Whether a post
        // target may fire again is decided by the *edge* it was reached through
        // (`once` / `maxRuns` / `group`, enforced via `ChainTracker.isOpen` in
        // DefaultEventAlgorithm), so a target with maxRuns > 1 can refire and a
        // target converged on by several source edges can be reached once per
        // edge. Only the target's own `once` flag still applies here.
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
