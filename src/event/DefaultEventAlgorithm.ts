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
import RandomService from "../core/random/RandomService.js";
import {
  buildWeighted,
  logFactors,
  pickWeighted,
  WeightedEntry,
} from "../core/random/Weighting.js";
import EventDirector, { DirectorContext } from "./EventDirector.js";
import ChainTracker from "./ChainTracker.js";

type PostEventSpec = string | PostIncidentConfig[];

/** Category cooldown strengths: back-to-back classes are pushed down hard. */
const CATEGORY_DECAY_NEAR = 0.35;
const CATEGORY_DECAY_MID = 0.7;
const CATEGORY_NEAR_YEARS = 2;
const CATEGORY_MID_YEARS = 4;

export default class DefaultEventAlgorithm implements IEventAlgorithm {
  private eventCenter: EventCenter;
  private logStore: LogStore;
  private eventHistory: EventHistory;
  private modPluginLoader: ModPluginLoader;
  private postEventScheduler: PostEventScheduler;
  private filters: IncidentFilter[];
  private eventBus: TypedEventBus;

  /** Seeded random stream (safe to save/replay), the narrative director, and
   *  the post-event graph bookkeeping. All container singletons. */
  private random: RandomService;
  private director: EventDirector;
  private chain: ChainTracker;

  /** Set while a choice event waits for the player to pick an option. */
  private pendingChoice: PendingChoice | null = null;

  /** Debug hook: the next roll is forced to this incident id when eligible. */
  private forcedId: string | null = null;

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
    this.random = container.resolve(RandomService);
    this.director = container.resolve(EventDirector);
    this.chain = container.resolve(ChainTracker);
  }

  public trigger(player: Player): void {
    // Do not roll a new event while the player owes us a decision.
    if (this.pendingChoice) return;

    const postTriggered = this.processPendingPostEvents(player);
    if (postTriggered) return;

    const matched = this.getMatchedIncidents(player.age);
    const eligible = this.filterEligible(matched);
    if (eligible.length === 0) return;

    const selected = this.takeForced(eligible) ?? this.getRandomIncident(eligible, player);
    if (selected) {
      this.executeIncident(selected.incident, selected.rangeKey, player);
    }
  }

  public reset(): void {
    this.eventHistory.reset();
    this.postEventScheduler.reset();
    this.pendingChoice = null;
    this.forcedId = null;
  }

  /** Debug: force the next eligible roll to this event. */
  public forceNextEvent(incidentId: string): boolean {
    if (!this.eventCenter.getIncidentById(incidentId)) return false;
    this.forcedId = incidentId;
    return true;
  }

  private takeForced(
    eligible: Array<{ incident: Incident; rangeKey: string }>,
  ): { incident: Incident; rangeKey: string } | undefined {
    if (!this.forcedId) return undefined;
    const match = eligible.find((e) => e.incident.id === this.forcedId);
    this.forcedId = null;
    return match;
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
      if (!this.tryExecutePostEvent(due[i], player)) continue; // failed → dropped
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
    // Re-check the edge's age window at fire time (cross-age chains).
    if (item.edge) {
      const { minAge, maxAge } = item.edge;
      if (minAge !== undefined && player.age < minAge) return false;
      if (maxAge !== undefined && player.age > maxAge) return false;
    }

    const originalWeight = incident.weight;
    if (item.weight !== undefined) incident.weight = item.weight;
    try {
      const candidate = { incident, rangeKey: "post" as const };
      const eligible = this.filterEligible([candidate]);
      if (eligible.length === 0) return false;
      this.executeIncident(incident, "post", player);
      if (item.edge) {
        this.chain.record(item.sourceId, item.edge, item.edgeIndex ?? 0);
      }
      return true;
    } finally {
      incident.weight = originalWeight;
    }
  }

  private schedulePostEvents(
    sourceId: string,
    post: PostEventSpec,
    player: Player,
  ): void {
    if (typeof post === "string") {
      this.postEventScheduler.add({
        sourceId,
        targetId: post,
        delay: 0,
        condition: undefined,
      });
      return;
    }
    if (!Array.isArray(post)) return;
    const index = this.selectedPostBranch(post, sourceId, player);
    if (index < 0) return;
    const edge = post[index];
    this.postEventScheduler.add({
      sourceId,
      targetId: edge.incident,
      delay: edge.delay ?? 0,
      weight: edge.weight,
      condition: edge.triggerCondition,
      edge,
      edgeIndex: index,
    });
  }

  /**
   * Resolve a post-event graph step: among the still-open edges (once / maxRuns
   * / group / age window / condition), pick one weighted. Returns the index into
   * `branches`, or -1 when the whole branch set is closed.
   */
  private selectedPostBranch(
    branches: PostIncidentConfig[],
    sourceId: string,
    player: Player,
  ): number {
    const entries = buildWeighted(
      branches.map((edge, index) => ({ edge, index })),
      ({ edge, index }) => {
        if (!this.chain.isOpen(sourceId, edge, index, player.age)) {
          return -Infinity;
        }
        if (edge.triggerCondition && !edge.triggerCondition(player)) {
          return -Infinity;
        }
        return Math.log(Math.max(1e-4, edge.weight ?? 1));
      },
    );
    const picked = pickWeighted(this.random, entries);
    if (picked < 0) return -1;
    const branch = entries[picked].item;
    this.random.logDraw({
      label: "postEvent.branch",
      age: player.age,
      candidates: entries.map((e) => ({
        id: e.item.edge.incident,
        weight: e.weight,
      })),
      chosen: branch.edge.incident,
    });
    return branch.index;
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
    this.eventHistory.markTriggered(
      incident.id,
      rangeKey,
      player.age,
      incident.category,
    );
    this.eventHistory.markBlocked(incident.excludedIds);
    this.logStore.addEvent(incident);
    // Feed the director's luck-streak memory.
    this.director.observe(incident);

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
    if (post) this.schedulePostEvents(incident.id, post, player);

    this.modPluginLoader.fireIncidentExecuted(incident, player);
    this.eventBus.emit("incident:executed", { incidentId: incident.id });
  }

  /**
   * Draw the next incident. Every candidate is scored once, in log space
   * (`base * fate * bias * weather * cooldown * category * repeat * director`),
   * then selected with a numerically stable softmax — so a long product chain
   * can neither overflow nor silently zero an event out (see {@link Weighting}).
   */
  protected getRandomIncident(
    list: Array<{ incident: Incident; rangeKey: string }>,
    player: Player,
  ): { incident: Incident; rangeKey: string } | undefined {
    const ctx: DirectorContext = {
      player,
      world: this.world,
      pressures: this.pressures,
      weather: this.weather,
    };
    const currentWeather = this.weather?.currentIdValue() ?? null;

    const entries: WeightedEntry<{ incident: Incident; rangeKey: string }>[] =
      buildWeighted(list, (item) => {
        const incident = item.incident;
        const base = incident.getWeight(player);
        // Active fate arcs bias the roll toward their favoured events.
        const fate = this.world ? this.world.fateWeight(incident.id) : 1;
        // Hidden-score / weather bands bias the roll toward events that favour them.
        const bias = pressureBiasFactor(incident.pressureBias, this.pressures);
        const weatherBias = weatherBiasFactor(
          incident.weatherBias,
          currentWeather,
        );
        const cooldown = this.cooldownFactor(incident, player.age);
        const category = this.categoryFactor(incident, player.age);
        const repeat = this.repeatFactor(incident);
        const director = this.director.factor(incident, ctx);
        return logFactors(
          base,
          fate,
          bias,
          weatherBias,
          cooldown,
          category,
          repeat,
          director,
        );
      });

    const index = pickWeighted(this.random, entries);
    this.random.logDraw({
      label: "event.roll",
      age: player.age,
      candidates: entries.map((e) => ({
        id: e.item.incident.id,
        weight: e.weight,
      })),
      chosen: index >= 0 ? entries[index].item.incident.id : null,
    });
    return index < 0 ? undefined : entries[index].item;
  }

  /** Hard cooldown: 0 (excluded) until `cooldown` years have passed. */
  private cooldownFactor(incident: Incident, age: number): number {
    if (incident.cooldown <= 0) return 1;
    const last = this.eventHistory.lastTriggeredAge(incident.id);
    if (last === undefined) return 1;
    return age - last < incident.cooldown ? 0 : 1;
  }

  /** Soft same-class decay so consecutive years aren't the same genre. */
  private categoryFactor(incident: Incident, age: number): number {
    if (!incident.category) return 1;
    const last = this.eventHistory.lastCategoryAge(incident.category);
    if (last === undefined) return 1;
    const gap = age - last;
    if (gap <= CATEGORY_NEAR_YEARS) return CATEGORY_DECAY_NEAR;
    if (gap <= CATEGORY_MID_YEARS) return CATEGORY_DECAY_MID;
    return 1;
  }

  /** Stronger damping the longer an event repeats itself. */
  private repeatFactor(incident: Incident): number {
    const n = this.eventHistory.consecutiveCountOf(incident.id);
    if (n <= 0) return 1;
    return Math.max(0.15, Math.pow(0.3, n));
  }
}
