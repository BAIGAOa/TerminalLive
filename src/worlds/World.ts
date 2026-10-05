import Player from "../world/Player.js";
import { Incident } from "../world/Incident.js";
import EventCenter from "../event/EventCenter.js";
import EventHistory from "../event/EventHistory.js";
import { IEventAlgorithm } from "../event/IEventAlgorithm.js";
import LogStore from "../core/store/LogStore.js";
import { WorldEventLoader } from "../event/WorldEventLoader.js";
import WorldCondition from "./WorldCondition.js";
import { WorldObjective } from "./WorldObjective.js";

export interface WorldUnlockEdge {
  levelId: string;
  requires: WorldCondition[];
}

export interface WorldManifest {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** Emoji shown on the selection card. */
  icon: string;
  /** Theme chips for selection grouping. */
  tags: string[];
  /** Content identity for saves. */
  contentVersion: number;
  /** Era the chronicle starts in. */
  startEra?: string;
  /** Region the player is born into. */
  startRegion?: string;
  /** Offset mapping player age → chronicle year. */
  eraYearOffset: number;
  /** Whether scoped content dirs replace (vs layer over) the baseline. */
  selfContained: boolean;
  /** World-rule ids applied for the whole life. */
  worldRules: string[];
  /** Absolute path to the world's content directory (for the content loader). */
  contentDir: string;
  /** World ids that must be completed to unlock this one. */
  unlockRequires: string[];
  /** Extra conditions gating the unlock. */
  unlockConditions: WorldCondition[];
  nextLevel: string | "none";
  /** Optional branching successors (first with met requirements wins). */
  nextBranches?: WorldUnlockEdge[];
  /** Optional act/chapter label for grouping in the UI. */
  act?: string;
  difficultyIdentification: string;
  /** Victory conditions for the world. */
  nextLevelUnlock: WorldCondition[];
  objectives?: WorldObjective[];
}

export default class World {
  public readonly id: string;
  public readonly nameKey: string;
  public readonly descriptionKey: string;
  public readonly icon: string;
  public readonly tags: string[];
  public readonly contentVersion: number;
  public readonly startEra?: string;
  public readonly startRegion?: string;
  public readonly eraYearOffset: number;
  public readonly selfContained: boolean;
  public readonly worldRules: string[];
  public readonly contentDir: string;
  public readonly unlockRequires: string[];
  public readonly unlockConditions: WorldCondition[];

  public readonly nextLevel: string | "none";
  public readonly nextLevelUnlock: WorldCondition[];
  public readonly nextBranches: WorldUnlockEdge[];
  public readonly objectives: WorldObjective[];
  /** Act/chapter label (for grouping), if the level declares one. */
  public readonly act?: string;
  /** Objective ids met this life (reward granted once each). */
  private completedObjectives = new Set<string>();

  public readonly eventCenter: EventCenter;
  public readonly eventHistory: EventHistory;
  public readonly algorithm: IEventAlgorithm;
  public readonly logStore: LogStore;
  public readonly eventLoader: WorldEventLoader;

  // 难度标识，用来表示难度，1就表示简单，这将有助于UI显示
  // 比如如果是1，那么这个关卡就会显示在UI界面的左边菜单的简单分类里面
  public readonly difficultyIdentification: string = "easy";
  public player: Player;

  public readonly initialPlayerAttributes?: Record<string, unknown>;

  constructor(
    config: WorldManifest,
    player: Player,
    algorithm: IEventAlgorithm,
    eventCenter: EventCenter,
    eventHistory: EventHistory,
    logStore: LogStore,
    eventLoader: WorldEventLoader,
    initialPlayerAttributes?: Record<string, unknown>,
  ) {
    this.id = config.id;
    this.nameKey = config.nameKey;
    this.descriptionKey = config.descriptionKey;
    this.icon = config.icon;
    this.tags = config.tags;
    this.contentVersion = config.contentVersion;
    this.startEra = config.startEra;
    this.startRegion = config.startRegion;
    this.eraYearOffset = config.eraYearOffset;
    this.selfContained = config.selfContained;
    this.worldRules = config.worldRules;
    this.contentDir = config.contentDir;
    this.unlockRequires = config.unlockRequires;
    this.unlockConditions = config.unlockConditions;
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
  public evaluateObjectives(player: Player): WorldObjective[] {
    const newly: WorldObjective[] = [];
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
    // Event history is shared across a whole life (see WorldManifestLoader) and is only
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
