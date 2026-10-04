import Player from "../world/Player.js";
import { Incident, PostIncidentConfig } from "../world/Incident.js";
import { ChoiceDef } from "../world/choices.js";
import { meetsRequirements } from "../world/requirements.js";
import { applyEffectPayload } from "../world/effects/applyEffects.js";
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
import { PendingChoice, PendingOption } from "./PendingChoice.js";
import TypedEventBus from "../core/TypedEventBus.js";
import { container } from "../Container.js";
import WorldFilter from "../world/chronicle/WorldFilter.js";
import type WorldState from "../world/chronicle/WorldState.js";
import PressureFilter, {
  pressureBiasFactor,
} from "../world/pressures/PressureFilter.js";
import type PressureState from "../world/pressures/PressureState.js";
import WeatherFilter, {
  weatherBiasFactor,
} from "../world/weather/WeatherFilter.js";
import type WeatherState from "../world/weather/WeatherState.js";

type PostEventSpec = string | PostIncidentConfig[];

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

  /** Set while a choice event waits for the player to pick an option. */
  private pendingChoice: PendingChoice | null = null;

  /** The living world (for worldGate filtering + fate weighting), if any. */
  private world: WorldState | null;
  /** The hidden-score web (for pressureGate filtering + bias), if any. */
  private pressures: PressureState | null;
  /** The current weather (for weatherGate filtering + bias), if any. */
  private weather: WeatherState | null;

  constructor(deps: {
    eventCenter: EventCenter;
    logStore: LogStore;
    eventHistory: EventHistory;
    modPluginLoader: ModPluginLoader;
    filters?: IncidentFilter[];
    world?: WorldState | null;
    pressures?: PressureState | null;
    weather?: WeatherState | null;
  }) {
    this.eventCenter = deps.eventCenter;
    this.logStore = deps.logStore;
    this.eventHistory = deps.eventHistory;
    this.modPluginLoader = deps.modPluginLoader;
    this.world = deps.world ?? null;
    this.pressures = deps.pressures ?? null;
    this.weather = deps.weather ?? null;
    this.postEventScheduler = new PostEventScheduler();
    this.filters = deps.filters ?? [
      new BlockedFilter(),
      new PredecessorFilter(),
      new OnceFilter(),
      new WorldFilter(),
      new PressureFilter(),
      new WeatherFilter(),
    ];

    this.eventBus = container.resolve(TypedEventBus);
  }

  public trigger(player: Player): void {
    // Do not roll a new event while the player owes us a decision.
    if (this.pendingChoice) return;

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
    this.pendingChoice = null;
  }

  // ── choice API ─────────────────────────────────────────────────
  public hasPendingChoice(): boolean {
    return this.pendingChoice !== null;
  }

  public getPendingChoice(): PendingChoice | null {
    return this.pendingChoice;
  }

  public resolveChoice(optionId: string, player: Player): boolean {
    const pending = this.pendingChoice;
    if (!pending) return false;
    const option = pending.options.find((o) => o.def.id === optionId);
    if (!option || option.disabled) return false;

    const incident =
      pending.incident ?? this.eventCenter.getIncidentById(pending.incidentId);
    this.pendingChoice = null;
    if (!incident) return false;

    this.commitIncident(incident, pending.rangeKey, player, option.def);
    this.modPluginLoader.fireChoice(incident, optionId, player);
    this.eventBus.emit("choice:resolved", {
      incidentId: incident.id,
      optionId,
    });
    return true;
  }

  /** Re-offer a saved choice after a load (options re-derived from live state). */
  public restorePendingChoice(
    incidentId: string,
    rangeKey: string,
    player: Player,
  ): void {
    const incident = this.eventCenter.getIncidentById(incidentId);
    if (!incident || !incident.hasChoices()) return;
    this.offerChoice(incident, rangeKey, player);
  }

  /**
   * Offer a choice that is not part of the event pool (e.g. an NPC-initiated
   * offer). The incident instance is stored on the pending choice so it can be
   * resolved without an EventCenter lookup.
   */
  public offerExternalChoice(
    incident: Incident,
    rangeKey: string,
    player: Player,
  ): void {
    this.offerChoice(incident, rangeKey, player);
  }

  // ── post events ────────────────────────────────────────────────
  private processPendingPostEvents(player: Player): boolean {
    const due = this.postEventScheduler.advanceRound();
    for (let i = 0; i < due.length; i++) {
      if (!this.tryExecutePostEvent(due[i], player)) continue; // failed → dropped, as before
      // Don't lose the other due items this turn — re-queue them.
      for (let j = i + 1; j < due.length; j++) {
        this.postEventScheduler.add({ ...due[j], delay: 0 });
      }
      return true;
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

  private schedulePostEvents(sourceId: string, post: PostEventSpec): void {
    if (typeof post === "string") {
      this.postEventScheduler.add({
        sourceId,
        targetId: post,
        delay: 0,
        condition: undefined,
      });
    } else if (Array.isArray(post)) {
      const selected = this.selectedPostBranch(post);
      if (selected) {
        this.postEventScheduler.add({
          sourceId,
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

  // ── selection ──────────────────────────────────────────────────
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
        world: this.world,
        pressures: this.pressures,
        weather: this.weather,
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

    if (incident.hasChoices()) {
      this.offerChoice(incident, rangeKey, player);
      return;
    }

    this.commitIncident(incident, rangeKey, player, null);
  }

  private offerChoice(
    incident: Incident,
    rangeKey: string,
    player: Player,
  ): void {
    const options: PendingOption[] = [];
    for (const def of incident.choices ?? []) {
      const ok = meetsRequirements(player, def.require);
      if (!ok && def.hidden) continue;
      options.push({ def, disabled: !ok });
    }
    if (options.length === 0 || options.every((o) => o.disabled)) {
      // Every option was gated out (empty or all-locked) — commit without a
      // choice so the event does not stay eligible and dead-lock forever.
      this.commitIncident(incident, rangeKey, player, null);
      return;
    }

    this.pendingChoice = {
      incidentId: incident.id,
      nameKey: incident.nameKey,
      textKey: incident.textKey,
      rangeKey,
      options,
      incident,
    };
    this.eventBus.emit("choice:offered", { incidentId: incident.id });
  }

  private commitIncident(
    incident: Incident,
    rangeKey: string,
    player: Player,
    chosen: ChoiceDef | null,
  ): void {
    this.eventHistory.markTriggered(incident.id, rangeKey);
    this.eventHistory.markBlocked(incident.excludedIds);
    this.logStore.addEvent(incident);

    if (chosen) {
      applyEffectPayload(
        player,
        {
          effects: chosen.effects,
          items: chosen.items,
          removeItems: chosen.removeItems,
          relationship: chosen.relationship,
          buff: chosen.buff,
          flag: chosen.flag,
          karma: chosen.karma,
          faction: chosen.faction,
        },
        this.world,
      );
    } else {
      incident.apply(player);
    }

    const post: PostEventSpec | null = chosen?.postEvent ?? incident.postEvent;
    if (post) this.schedulePostEvents(incident.id, post);

    this.modPluginLoader.fireIncidentExecuted(incident, player);
    this.eventBus.emit("incident:executed", { incidentId: incident.id });
  }

  protected getRandomIncident(
    list: Array<{ incident: Incident; rangeKey: string }>,
    player: Player,
  ): { incident: Incident; rangeKey: string } | undefined {
    return weightedRandom(list, (item) => {
      const base = item.incident.getWeight(player);
      // Active fate arcs bias the roll toward their favoured events.
      const fate = this.world ? this.world.fateWeight(item.incident.id) : 1;
      // Hidden-score / weather bands bias the roll toward events that favour them.
      const bias = pressureBiasFactor(item.incident.pressureBias, this.pressures);
      const weatherBias = weatherBiasFactor(
        item.incident.weatherBias,
        this.weather?.currentIdValue() ?? null,
      );
      return base * fate * bias * weatherBias;
    });
  }
}
