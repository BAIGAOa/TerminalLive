import { Scope, Scoped } from "di-wise";
import BaseRegistry from "./BaseRegistry.js";
import IncidentFilter from "../../event/IncidentFilter.js";

@Scoped(Scope.Container)
export default class FilterRegistry extends BaseRegistry<() => IncidentFilter> {
  public create(name: string): IncidentFilter {
    return this.get(name)();
  }
}