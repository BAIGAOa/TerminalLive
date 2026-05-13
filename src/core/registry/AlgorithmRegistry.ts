import { Scope, Scoped } from "di-wise";
import BaseRegistry from "./BaseRegistry.js";
import EventCenter from "../../event/EventCenter.js";
import LogStore from "../store/LogStore.js";
import EventHistory from "../../event/EventHistory.js";
import ModPluginLoader from "../mod/ModPluginLoader.js";
import IncidentFilter from "../../event/IncidentFilter.js";
import { IEventAlgorithm } from "../../event/IEventAlgorithm.js";

export type AlgorithmFactory = (deps: {
  eventCenter: EventCenter;
  logStore: LogStore;
  eventHistory: EventHistory;
  modPluginLoader: ModPluginLoader;
  filters?: IncidentFilter[];
}) => IEventAlgorithm;

@Scoped(Scope.Container)
export default class AlgorithmRegistry extends BaseRegistry<AlgorithmFactory> {}