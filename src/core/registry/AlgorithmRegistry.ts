import BaseRegistry from "./BaseRegistry.js";
import EventCenter from "../../event/EventCenter.js";
import LogStore from "../store/LogStore.js";
import EventHistory from "../../event/EventHistory.js";
import PluginHost from "../plugin/PluginHost.js";
import IncidentFilter from "../../event/IncidentFilter.js";
import { IEventAlgorithm } from "../../event/IEventAlgorithm.js";
import type WorldState from "../../world/chronicle/WorldState.js";
import type PressureState from "../../world/pressures/PressureState.js";
import type WeatherState from "../../world/weather/WeatherState.js";

export type AlgorithmFactory = (deps: {
  eventCenter: EventCenter;
  logStore: LogStore;
  eventHistory: EventHistory;
  pluginHost: PluginHost;
  filters?: IncidentFilter[];
  world?: WorldState | null;
  pressures?: PressureState | null;
  weather?: WeatherState | null;
}) => IEventAlgorithm;

export default class AlgorithmRegistry extends BaseRegistry<AlgorithmFactory> {}