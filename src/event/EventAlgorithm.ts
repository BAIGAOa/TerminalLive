import { inject, Scope, Scoped } from "di-wise";
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

@Scoped(Scope.Container)
export default class EventAlgorithm {
  private eventCenter: EventCenter;
  private logStore: LogStore;
  private eventHistory: EventHistory;

  private postEventScheduler: PostEventScheduler = new PostEventScheduler();

  private filters: IncidentFilter[] = [
    new BlockedFilter(),
    new PredecessorFilter(),
    new OnceFilter(),
  ];

  constructor() {
    this.eventCenter = inject(EventCenter);
    this.logStore = inject(LogStore);
    this.eventHistory = inject(EventHistory);
  }

  public trigger(player: Player) {
    const postTriggered = this.processPendingPostEvents(player);
    //提前返回，这意味着后置事件将永远高于普通事件
    if (postTriggered) return;

    const matched = this.getMatchedIncidents(player.age);
    const eligible = this.filterEligible(matched);
    if (eligible.length === 0) return;

    const selected = this.getRandomIncident(eligible, player);
    if (selected) {
      this.executeIncident(selected.incident, selected.rangeKey, player);
    }
  }

  /**
   * 处理队列中的后置事件
   */
  private processPendingPostEvents(player: Player): boolean {
    const duoEvent = this.postEventScheduler.advanceRound();
    for (const item of duoEvent) {
      if (this.tryExecutePostEvent(item, player)) {
        return true;
      }
    }
    return false;
  }

  private tryExecutePostEvent(item: PendingPostEvent, player: Player) {
    const incident = this.eventCenter.getIncidentById(item.targetId);
    if (!incident) {
      console.warn(`后置事件id${item.targetId}不存在`);
      return false;
    }
    if (item.condition && !item.condition(player)) {
      return false;
    }
    const originalWeight = incident.weight;
    if (item.weight !== undefined) {
      incident.weight = item.weight;
    }
    try {
      const candidate = { incident, rangeKey: "post" as const };
      const eligible = this.filterEligible([candidate]);
      if (eligible.length === 0) {
        return false;
      }
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

  /**
   * 根据权重随机选择一个分支
   */
  private selectedPostBranch(
    branchs: PostIncidentConfig[],
  ): PostIncidentConfig | null {
    return weightedRandom(branchs, (branch) => branch.weight ?? 1) ?? null;
  }

  /** 根据年龄筛选事件匹配的列表
   * 返回一个元组，这是因为我们要知道事件是从哪里出来的
   */
  private getMatchedIncidents(
    age: number,
  ): Array<{ incident: Incident; rangeKey: string }> {
    const result: Array<{ incident: Incident; rangeKey: string }> = [];
    const allRanges = this.eventCenter.getAllRanges();

    for (const rangeKey of allRanges) {
      const [start, end] = rangeKey.split("-").map(Number);
      if (age >= start && age <= end) {
        const incidents = this.eventCenter.getIncidentsByRange(rangeKey);
        if (incidents) {
          incidents.forEach((incident) => {
            result.push({ incident, rangeKey });
          });
        }
      }
    }

    return result;
  }

  /** 根据逻辑规则过滤事件 */
  private filterEligible(
    candidates: Array<{ incident: Incident; rangeKey: string }>,
  ) {
    return candidates.filter(({ incident, rangeKey }) => {
      const context = {
        incident,
        rangeKey,
        triggeredHistory: this.eventHistory.getTriggered(),
        blockedHistory: this.eventHistory.getBlocked(),
        rangeHistory: this.eventHistory.getRangeKeyRecord(),
      };
      return this.filters.every((filter) => filter.isEligible(context));
    });
  }

  /** 执行操作 */
  private executeIncident(
    incident: Incident,
    rangeKey: string,
    player: Player,
  ) {
    this.eventHistory.markTriggered(incident.id, rangeKey);
    this.eventHistory.markBlocked(incident.excludedIds);
    this.logStore.addEvent(incident);
    incident.apply(player);

    if (incident.postEvent) {
      this.schedulePostEvents(incident);
    }
  }

  /**
   * 根据权重挑选事件
   */
  private getRandomIncident(
    list: Array<{ incident: Incident; rangeKey: string }>,
    player: Player,
  ) {
    return weightedRandom(list, (item) => item.incident.getWeight(player));
  }

  public reset(): void {
    this.eventHistory.reset();
    this.postEventScheduler.reset();
  }
}
