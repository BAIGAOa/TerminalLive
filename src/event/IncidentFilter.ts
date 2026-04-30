import FilterContext from "./FilterContext.js";

export default interface IncidentFilter {
    isEligible(context: FilterContext): boolean;

}
