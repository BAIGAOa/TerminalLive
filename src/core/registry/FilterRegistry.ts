import BaseRegistry from "./BaseRegistry.js";
import IncidentFilter from "../../event/IncidentFilter.js";

export default class FilterRegistry extends BaseRegistry<() => IncidentFilter> {
  public create(name: string): IncidentFilter {
    return this.get(name)();
  }
}