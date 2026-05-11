import { container } from "../Container.js";
import AlgorithmRegistry from "../core/registry/AlgorithmRegistry.js";
import FilterRegistry from "../core/registry/FilterRegistry.js";
import DefaultEventAlgorithm from "../event/DefaultEventAlgorithm.js";
import BlockedFilter from "../event/filters/BlockedFilter.js";
import OnceFilter from "../event/filters/OnceFilter.js";
import PredecessorFilter from "../event/filters/PredecessorFilter.js";

export function registerBuiltinRegistrations(): void {
  const algoReg = container.resolve(AlgorithmRegistry);
  const filterReg = container.resolve(FilterRegistry);

  // 算法
  algoReg.register("default", (deps) => new DefaultEventAlgorithm(deps));
  // algoReg.register("multiEvent", (deps) => new MultiEventAlgorithm(deps));

  // 过滤器
  filterReg.register("blocked", () => new BlockedFilter());
  filterReg.register("predecessor", () => new PredecessorFilter());
  filterReg.register("once", () => new OnceFilter());
}
