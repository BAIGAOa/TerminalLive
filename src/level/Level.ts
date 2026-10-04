import Player from "../world/Player.js";
import { Incident } from "../world/Incident.js";
import EventCenter from "../event/EventCenter.js";
import EventHistory from "../event/EventHistory.js";
import { IEventAlgorithm } from "../event/IEventAlgorithm.js";
import LogStore from "../core/store/LogStore.js";
import { LevelEventLoader } from "../event/LevelEventLoader.js";
import LevelCondition from "./LevelCondition.js";
import { LevelObjective } from "./LevelObjective.js";

export interface LevelBranch {
  levelId: string;
  requires: LevelCondition[];
}

export interface LevelConfig {
  id: string;
  nameKey: string;
  descriptionKey: string;
  nextLevel: string | "none";
  /** Optional branching successors (first with met requirements wins). */
  nextBranches?: LevelBranch[];
  /** Optional act/chapter label for grouping in the UI. */
  act?: string;
  difficultyIdentification: string;
  nextLevelUnlock: LevelCondition[];
  objectives?: LevelObjective[];
}

export default class Level {
  public readonly id: string;
  public readonly nameKey: string;
  public readonly descriptionKey: string;

  public readonly nextLevel: string | "none";
  public readonly nextLevelUnlock: LevelCondition[];
  public readonly nextBranches: LevelBranch[];
  public readonly objectives: LevelObjective[];
  /** Act/chapter label (for grouping), if the level declares one. */
  public readonly act?: string;
  /** Objective ids met this life (reward granted once each). */
  private completedObjectives = new Set<string>();

  public readonly eventCenter: EventCenter;
  public readonly eventHistory: EventHistory;
  public readonly algorithm: IEventAlgorithm;
  public readonly logStore: LogStore;
  public readonly eventLoader: LevelEventLoader;

  // 难度标识，用来表示难度，1就表示简单，这将有助于UI显示
  // 比如如果是1，那么这个关卡就会显示在UI界面的左边菜单的简单分类里面
  public readonly difficultyIdentification: string = "easy";
  public player: Player;

  public readonly initialPlayerAttributes?: Record<string, unknown>;

  constructor(
    config: LevelConfig,
    player: Player,
    algorithm: IEventAlgorithm,
    eventCenter: EventCenter,
    eventHistory: EventHistory,
    logStore: LogStore,
    eventLoader: LevelEventLoader,
    initialPlayerAttributes?: Record<string, unknown>,
  ) {
    this.id = config.id;
    this.nameKey = config.nameKey;
    this.descriptionKey = config.descriptionKey;
    this.nextLevel = config.nextLevel;

    this.player = player;
    this.eventCenter = eventCenter;
    this.eventHistory = eventHistory;
    this.algorithm = algorithm;
    this.logStore = logStore;
    this.eventLoader = eventLoader;

    this.difficultyIdentification = config.difficultyIdentification;
    this.nextLevelUnlock = config.nextLevelUnlock;
    this.nextBranches = config.nextBranches ?? [];
    this.objectives = config.objectives ?? [];
    this.act = config.act;
    this.initialPlayerAttributes = initialPlayerAttributes;
  }

  /** Reset per-life objective progress when this level begins a run. */
  public beginObjectives(): void {
    this.completedObjectives = new Set();
  }

  public completedObjectiveIds(): string[] {
    return [...this.completedObjectives];
  }

  /** Restore per-life objective progress loaded from a save. */
  public restoreObjectives(ids: string[]): void {
    this.completedObjectives = new Set(ids);
  }

  /** Evaluate all objectives; returns the ones completed for the first time. */
  public evaluateObjectives(player: Player): LevelObjective[] {
    const newly: LevelObjective[] = [];
    for (const obj of this.objectives) {
      if (this.completedObjectives.has(obj.id)) continue;
      if (obj.condition.customsClearance(player)) {
        this.completedObjectives.add(obj.id);
        newly.push(obj);
      }
    }
    return newly;
  }

  /** End the current turn: age the player a year and roll for an event. */
  public endTurn(): void {
    this.player.tickYear();
    this.algorithm.trigger(this.player);
  }

  public hasPendingChoice(): boolean {
    return this.algorithm.hasPendingChoice?.() ?? false;
  }

  public getPendingChoice() {
    return this.algorithm.getPendingChoice?.() ?? null;
  }

  public resolveChoice(optionId: string): boolean {
    return this.algorithm.resolveChoice?.(optionId, this.player) ?? false;
  }

  /** Re-offer a pending choice restored from a save. */
  public restorePendingChoice(
    incidentId: string,
    rangeKey: string,
    player: Player,
  ): void {
    this.algorithm.restorePendingChoice?.(incidentId, rangeKey, player);
  }

  /** Offer a choice from outside the event pool (e.g. an NPC-initiated offer). */
  public offerExternalChoice(incident: Incident, player: Player): void {
    this.algorithm.offerExternalChoice?.(incident, "npc", player);
  }

  public reset(): void {
    // Event history is shared across a whole life (see LevelLoader) and is only
    // reset at a new life's start — clearing it here would let once-per-life
    // events refire as the player crosses level (age-stage) boundaries.
    this.eventCenter.clear();
    this.algorithm.reset();
    this.beginObjectives();
  }

  public dispose(): void {
    this.eventCenter.clear();
    this.algorithm.reset();
  }
}
