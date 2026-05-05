import Player from "../world/Player.js";
import { Incident, PostIncidentConfig } from "../world/Incident.js";
import LogStore from "../core/store/LogStore.js";
import EventCenter from "./EventCenter.js";
import IncidentFilter from "./IncidentFilter.js";
import BlockedFilter from "./filters/BlockedFilter.js";
import PredecessorFilter from "./filters/PredecessorFilter.js";
import OnceFilter from "./filters/OnceFilter.js";
import EventHistory from "./EventHistory.js";
import PostEventScheduler, { PendingPostEvent } from "./PostEventScheduler.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";
import FilterContext from "./FilterContext.js";
import { IEventAlgorithm } from "./IEventAlgorithm.js";
import TypedEventBus from "../core/TypedEventBus.js";
import { container } from "../Container.js";

function weightedRandom<T>(
  items: T[],
  weightFn: (item: T) => number,
): T | undefined {
  const totalWeight = items.reduce((sum, item) => sum + weightFn(item), 0);
  if (totalWeight <= 0) return undefined;
  let random = Math.random() * totalWeight;
  for (const item of items) {
    const w = weightFn(item);
    if (random < w) return item;
    random -= w;
  }
  return items[items.length - 1];
}

export default class DefaultEventAlgorithm implements IEventAlgorithm {
  private eventCenter: EventCenter;
  private logStore: LogStore;
  private eventHistory: EventHistory;
  private modPluginLoader: ModPluginLoader;
  private postEventScheduler: PostEventScheduler;
  private filters: IncidentFilter[];

  private eventBus: TypedEventBus;

  constructor(deps: {
    eventCenter: EventCenter;
    logStore: LogStore;
    eventHistory: EventHistory;
    modPluginLoader: ModPluginLoader;
    filters?: IncidentFilter[];
  }) {
    this.eventCenter = deps.eventCenter;
    this.logStore = deps.logStore;
    this.eventHistory = deps.eventHistory;
    this.modPluginLoader = deps.modPluginLoader;
    this.postEventScheduler = new PostEventScheduler();
    this.filters = deps.filters ?? [
      new BlockedFilter(),
      new PredecessorFilter(),
      new OnceFilter(),
    ];

    this.eventBus = container.resolve(TypedEventBus);
  }

  public trigger(player: Player): void {
    const postTriggered = this.processPendingPostEvents(player);
    if (postTriggered) return;

    const matched = this.getMatchedIncidents(player.age);
    const eligible = this.filterEligible(matched);
    if (eligible.length === 0) return;

    const selected = this.getRandomIncident(eligible, player);
    if (selected) {
      this.executeIncident(selected.incident, selected.rangeKey, player);
    }
  }

  public reset(): void {
    this.eventHistory.reset();
    this.postEventScheduler.reset();
  }

  private processPendingPostEvents(player: Player): boolean {
    const duoEvent = this.postEventScheduler.advanceRound();
    for (const item of duoEvent) {
      if (this.tryExecutePostEvent(item, player)) return true;
    }
    return false;
  }

  private tryExecutePostEvent(item: PendingPostEvent, player: Player): boolean {
    const incident = this.eventCenter.getIncidentById(item.targetId);
    if (!incident) {
      console.warn(`后置事件id${item.targetId}不存在`);
      return false;
    }
    if (item.condition && !item.condition(player)) return false;

    const originalWeight = incident.weight;
    if (item.weight !== undefined) incident.weight = item.weight;
    try {
      const candidate = { incident, rangeKey: "post" as const };
      const eligible = this.filterEligible([candidate]);
      if (eligible.length === 0) return false;
      this.executeIncident(incident, "post", player);
      return true;
    } finally {
      incident.weight = originalWeight;
    }
  }

  private schedulePostEvents(source: Incident): void {
    if (typeof source.postEvent === "string") {
      this.postEventScheduler.add({
        sourceId: source.id,
        targetId: source.postEvent,
        delay: 0,
        condition: undefined,
      });
    } else if (Array.isArray(source.postEvent)) {
      const selected = this.selectedPostBranch(source.postEvent);
      if (selected) {
        this.postEventScheduler.add({
          sourceId: source.id,
          targetId: selected.incident,
          delay: selected.delay ?? 0,
          weight: selected.weight,
          condition: selected.triggerCondition,
        });
      }
    }
  }

  private selectedPostBranch(
    branches: PostIncidentConfig[],
  ): PostIncidentConfig | null {
    return weightedRandom(branches, (b) => b.weight ?? 1) ?? null;
  }

  private getMatchedIncidents(
    age: number,
  ): Array<{ incident: Incident; rangeKey: string }> {
    const result: Array<{ incident: Incident; rangeKey: string }> = [];
    for (const rangeKey of this.eventCenter.getAllRanges()) {
      const [start, end] = rangeKey.split("-").map(Number);
      if (age >= start && age <= end) {
        const incidents = this.eventCenter.getIncidentsByRange(rangeKey);
        if (incidents) {
          incidents.forEach((incident) => result.push({ incident, rangeKey }));
        }
      }
    }
    return result;
  }

  private filterEligible(
    candidates: Array<{ incident: Incident; rangeKey: string }>,
  ): Array<{ incident: Incident; rangeKey: string }> {
    return candidates.filter(({ incident, rangeKey }) => {
      const context: FilterContext = {
        incident,
        rangeKey,
        triggeredHistory: this.eventHistory.getTriggered(),
        blockedHistory: this.eventHistory.getBlocked(),
        rangeHistory: this.eventHistory.getRangeKeyRecord(),
      };
      return this.filters.every((filter) => filter.isEligible(context));
    });
  }

  protected executeIncident(
    incident: Incident,
    rangeKey: string,
    player: Player,
  ): void {
    if (!this.modPluginLoader.fireIncidentTrigger(incident, player)) return;

    this.eventHistory.markTriggered(incident.id, rangeKey);
    this.eventHistory.markBlocked(incident.excludedIds);
    this.logStore.addEvent(incident);
    incident.apply(player);

    if (incident.postEvent) {
      this.schedulePostEvents(incident);
    }

    this.modPluginLoader.fireIncidentExecuted(incident, player);

    this.eventBus.emit("incident:executed", {
      incidentId: incident.id,
    });
  }

  protected getRandomIncident(
    list: Array<{ incident: Incident; rangeKey: string }>,
    player: Player,
  ): { incident: Incident; rangeKey: string } | undefined {
    return weightedRandom(list, (item) => item.incident.getWeight(player));
  }
}
