import { inject } from "../Container.js";
import Level from "./Level.js";
import LevelLoader from "./LevelLoader.js";
import Player from "../world/Player.js";
import { Incident } from "../world/Incident.js";
import EventHistory from "../event/EventHistory.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import TypedEventBus from "../core/TypedEventBus.js";
import ModMonitor from "../core/mod/ModMonitor.js";
import DifficultyRegistry from "../core/registry/DifficultyRegistry.js";
import TraitRegistry from "../world/traits/TraitRegistry.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import NpcSimulation from "../world/relationships/NpcSimulation.js";
import CareerSystem from "../world/careers/CareerSystem.js";
import EconomySystem from "../world/economy/EconomySystem.js";
import HealthSystem from "../world/health/HealthSystem.js";
import PoliticsSystem from "../world/politics/PoliticsSystem.js";
import RegionsSystem from "../world/regions/RegionsSystem.js";
import WorldChainSystem from "../world/chains/WorldChainSystem.js";
import { hasCapability } from "../core/mod/capabilities.js";
import NarrativeSystem from "../world/narrative/NarrativeSystem.js";
import WorldState from "../world/chronicle/WorldState.js";
import PressureState from "../world/pressures/PressureState.js";
import WeatherState from "../world/weather/WeatherState.js";
import RandomService from "../core/random/RandomService.js";
import EventDirector from "../event/EventDirector.js";
import ChainTracker from "../event/ChainTracker.js";
import LineageStore from "../core/store/LineageStore.js";
import { computeInheritance } from "../world/lineage/inheritance.js";
import { applyEffectPayload } from "../world/effects/applyEffects.js";
import { difficultyModifier } from "./DifficultyModifier.js";
import { resolveBranch } from "./levelProgression.js";
import LevelRecordsStore from "../core/store/LevelRecordsStore.js";

type Listener = () => void;

export default class LevelManager {
  private levelLoader: LevelLoader;
  private modPluginLoader: ModPluginLoader;
  private modRegistry: ModMonitor;
  private configStore: ConfigStore;
  private eventBus: TypedEventBus;

  private levels: Map<string, Level> = new Map();
  private completedLevels = new Set<string>();
  private _current: Level | null = null;
  /** Saved per-level event history, applied when the level is re-entered. */
  private pendingHistory: Parameters<EventHistory["restoreFromArchive"]>[0] | null = null;
  /** Levels that no other level points to as `nextLevel` (the life's start). */
  private rootLevelIds = new Set<string>();
  private traitRegistry: TraitRegistry;
  private npcRegistry: NpcRegistry;
  private world: WorldState;
  private pressures: PressureState;
  private weather: WeatherState;
  private random: RandomService;
  private director: EventDirector;
  private chain: ChainTracker;
  private lineage: LineageStore;
  private npcSim: NpcSimulation;
  private levelRecords: LevelRecordsStore;
  private careers: CareerSystem;
  private economy: EconomySystem;
  private health: HealthSystem;
  private politics: PoliticsSystem;
  private regions: RegionsSystem;
  private chains: WorldChainSystem;
  private narrative: NarrativeSystem;

  public lastPlayedLevelId: string | null = null;

  private player: Player | null = null;
  private listeners = new Set<Listener>();

  private difficultyRegistry: DifficultyRegistry;

  private version: number = 0;

  constructor() {
    this.levelLoader = inject(LevelLoader);
    this.modPluginLoader = inject(ModPluginLoader);
    this.modRegistry = inject(ModMonitor);
    this.configStore = inject(ConfigStore);
    this.eventBus = inject(TypedEventBus);
    this.difficultyRegistry = inject(DifficultyRegistry);
    this.traitRegistry = inject(TraitRegistry);
    this.npcRegistry = inject(NpcRegistry);
    this.world = inject(WorldState);
    this.pressures = inject(PressureState);
    this.weather = inject(WeatherState);
    this.random = inject(RandomService);
    this.director = inject(EventDirector);
    this.chain = inject(ChainTracker);
    this.lineage = inject(LineageStore);
    this.npcSim = inject(NpcSimulation);
    this.levelRecords = inject(LevelRecordsStore);
    this.careers = inject(CareerSystem);
    this.economy = inject(EconomySystem);
    this.health = inject(HealthSystem);
    this.politics = inject(PoliticsSystem);
    this.regions = inject(RegionsSystem);
    this.chains = inject(WorldChainSystem);
    this.narrative = inject(NarrativeSystem);
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public initCompletedLevels(levelId: string[] | undefined) {
    this.completedLevels = new Set(levelId ?? []);
    this.notify();
  }

  public isLevelCompleted(levelId: string) {
    return this.completedLevels.has(levelId);
  }

  public getAllLevels() {
    return this.levels;
  }

  public getLevel(id: string): Level | undefined {
    return this.levels.get(id);
  }

  /** Ids of the levels that start a new life (no other level points to them). */
  public getRootLevelIds(): string[] {
    return [...this.rootLevelIds];
  }

  public get current(): Level {
    if (!this._current) throw new Error("没有激活的关卡");
    return this._current;
  }

  public get currentPlayer(): Player {
    return this.current.player;
  }

  public setPlayer(player: Player): void {
    this.player = player;
  }

  public loadAllLevels(): void {
    if (!this.player) throw new Error("请先调用 setPlayer");

    // 加载内置关卡
    const builtinLevels = this.levelLoader.loadAll(this.player);
    for (const level of builtinLevels) {
      if (this.levels.has(level.id)) {
        console.warn(`内置关卡 ID "${level.id}" 冲突，已跳过`);
        continue;
      }
      this.levels.set(level.id, level);
      this.difficultyRegistry.register(level.difficultyIdentification, level);
    }

    // 加载所有已启用模组的扩展关卡
    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (!this.modRegistry.isValid(modName)) continue;
      if (!hasCapability(this.modRegistry.getModManifest(modName) ?? {}, "levels")) {
        continue;
      }

      const modLevelsPath = join(
        this.modRegistry.getModPath(modName),
        "levels",
      );
      const modLevels = this.levelLoader.loadDir(modLevelsPath, this.player);

      for (const level of modLevels) {
        if (this.levels.has(level.id)) {
          console.warn(
            `模组 "${modName}" 的关卡 ID "${level.id}" 冲突，已跳过`,
          );
          continue;
        }
        this.levels.set(level.id, level);
        this.difficultyRegistry.register(level.difficultyIdentification, level);
      }
    }

    // Roots = levels no other level points to. Traits apply when a life starts
    // on a root level.
    const referenced = new Set<string>();
    for (const level of this.levels.values()) {
      if (level.nextLevel !== "none") referenced.add(level.nextLevel);
      for (const branch of level.nextBranches) referenced.add(branch.levelId);
    }
    this.rootLevelIds = new Set(
      [...this.levels.keys()].filter((id) => !referenced.has(id)),
    );
  }

  public start(id: string): void {
    const level = this.levels.get(id);
    if (!level) throw new Error(`关卡 "${id}" 未加载`);

    // A fresh start never inherits a stashed save-history blob.
    this.pendingHistory = null;
    if (this._current) {
      this._current.dispose();
    }

    this._current = level;

    const isRoot = this.rootLevelIds.has(id);
    if (isRoot) {
      // A root level starts a brand-new life: reset the shared player (clears
      // items/relationships/flags/effects carried over), re-seed NPC affinities,
      // clear the completion set, then apply the level's start state + traits.
      level.player.resetForNewLife((level.initialPlayerAttributes ?? {}) as never);
      level.player.seedRelationships(this.npcRegistry.getAll());
      // Don't show the previous life's journal on the new life's root level.
      level.logStore.clear();
      // Wipe the shared life-scoped event history so once-per-life events can
      // fire again in the new life.
      inject(EventHistory).reset();
      // A new life gets a fresh random stream FIRST, so every subsystem reset
      // below (NPC sim rolls random start stats) draws from the new stream —
      // otherwise a seeded replay isn't reproducible.
      this.random.reset();
      this.director.reset();
      this.chain.reset();
      // Fresh cast of NPCs, each starting their own life trajectory.
      this.npcSim.reset();
      // Fresh work life (career ladder, skills, any venture).
      this.careers.reset();
      // Fresh market and empty portfolio.
      this.economy.reset();
      // Fresh body and mind.
      this.health.reset();
      // Fresh political landscape.
      this.politics.reset();
      // A new life resets the world too (region, karma, era, lore, fates). The
      // region roll is now in-stream with the reseeded random above.
      this.world.begin();
      // Regions are seeded at the world's chosen starting region.
      this.regions.reset(this.world.regionId);
      // Fresh chain of world events.
      this.chains.reset();
      // Fresh narrative arcs.
      this.narrative.reset();
      this.pressures.reset();
      this.weather.reset();
      this.completedLevels.clear();
      this.configStore.update({ completedLevels: [] });
    } else if (level.initialPlayerAttributes) {
      // Mid-chain level: carry the player over, applying only the level's
      // start state (e.g. the age of that stage) — see LevelLoader.buildLevel.
      level.player.applyAttributes(level.initialPlayerAttributes as never);
    }

    if (isRoot) {
      this.applyInheritance(level.player);
      this.applyTraits(level.player);
    }
    // Difficulty applies at every stage (once per tier per life, see method).
    this.applyDifficulty(level, level.player);
    // Each level is played once per life; reset its objective progress.
    level.beginObjectives();

    // 加载事件到当前关卡
    this.loadEventsFor(level);

    this.modPluginLoader.setPlayer(level.player);
    this.eventBus.emit("level:started", { levelId: id });
    this.lastPlayedLevelId = id;
    this.configStore.update({ lastLevelId: id });

    this.notify();
  }

  /** Whether a life is currently active (a level has been started/restored). */
  public hasActiveLevel(): boolean {
    return this._current !== null;
  }

  /**
   * Seed a fresh life with the previous generation's legacy. Runs after
   * `resetForNewLife` (which wipes stats/flags) and after `world.begin` (which
   * zeroes karma), and before `applyTraits`. A no-op when there is no ancestor.
   */
  private applyInheritance(player: Player): void {
    const plan = computeInheritance(this.lineage.getLast());
    if (!plan) return;
    player.applyDelta({ money: plan.money, ...plan.deltas });
    if (plan.karmaLean) this.world.applyKarma(plan.karmaLean);
    player.setFlag(plan.flag);
    player.notify();
  }

  /** Apply the config-selected traits to the player (once, at life start). */
  private applyTraits(player: Player): void {
    for (const id of this.configStore.getTraits()) {
      const def = this.traitRegistry.get(id);
      if (!def) continue;
      if (def.start) player.applyDelta(def.start);
      if (def.buff) player.addEffect(def.buff.id, def.buff.turns);
    }
    player.notify();
  }

  /**
   * Apply the level's difficulty as a real life-start modifier (stat shifts,
   * wealth scaling, a gating flag). Applied once per difficulty TIER per life
   * (tracked by a flag), so penalties land when the player first reaches a hard
   * stage but the same tier can't stack its bonuses across stages.
   */
  private applyDifficulty(level: Level, player: Player): void {
    const id = level.difficultyIdentification;
    const appliedFlag = `diff_applied_${id}`;
    if (player.flags.has(appliedFlag)) return;
    const mod = difficultyModifier(id);
    if (mod.statAdd) player.applyDelta(mod.statAdd);
    if (mod.moneyMul !== undefined) {
      player.setStat("money", Math.floor(player.money * mod.moneyMul));
    }
    if (mod.statBonus) player.applyDelta(mod.statBonus);
    if (mod.flag) player.setFlag(mod.flag);
    player.setFlag(appliedFlag);
    player.notify();
  }

  /** Resolve the next level: first satisfied branch, else the linear next. */
  public resolveNextLevelId(level: Level): string | null {
    return resolveBranch(level);
  }

  public update(): void {
    this.current.endTurn();
    // Let mods observe the player and the year.
    this.modPluginLoader.firePlayerUpdate(this.current.player);
    this.modPluginLoader.fireYear(this.current.player);
    this.applyObjectives();
    this.eventBus.emit("player:updated");
    this.notify();
  }

  /** Score the current level's objectives; grant rewards/medals for new ones. */
  private applyObjectives(): void {
    const level = this.current;
    const player = level.player;
    const newly = level.evaluateObjectives(player);
    if (newly.length === 0) return;
    for (const obj of newly) {
      if (obj.reward) {
        applyEffectPayload(
          player,
          {
            effects: obj.reward.effects,
            items: obj.reward.items,
            flag: obj.reward.flag,
            karma: obj.reward.karma,
          },
          this.world,
        );
      }
      this.eventBus.emit("toast", { textKey: obj.labelKey, kind: "info" });
      this.eventBus.emit("level:objective", {
        levelId: level.id,
        objectiveId: obj.id,
        optional: obj.optional,
      });
      if (obj.optional) void this.levelRecords.addMedal(level.id, obj.id);
    }
    player.notify();
  }

  public hasPendingChoice(): boolean {
    return this._current?.hasPendingChoice() ?? false;
  }

  public getPendingChoice() {
    return this._current?.getPendingChoice() ?? null;
  }

  public resolveChoice(optionId: string): boolean {
    const ok = this._current?.resolveChoice(optionId) ?? false;
    if (ok) {
      this.eventBus.emit("player:updated");
      this.notify();
    }
    return ok;
  }

  /** Debug: force the current level's next roll to a specific event. */
  public forceEvent(incidentId: string): boolean {
    if (!this._current) return false;
    return this._current.algorithm.forceNextEvent?.(incidentId) ?? false;
  }

  /** Re-offer a pending choice saved before the last quit (after a reload). */
  public restorePendingChoice(incidentId: string, rangeKey: string): void {
    if (!this._current || !this.player) return;
    this._current.restorePendingChoice(incidentId, rangeKey, this.player);
    this.notify();
  }

  /** Offer an NPC-initiated choice (skipped when one is already pending). */
  public offerNpcChoice(incident: Incident): void {
    if (!this._current || !this.player) return;
    if (this._current.hasPendingChoice()) return;
    this._current.offerExternalChoice(incident, this.player);
    this.notify();
  }

  /** Whether the current level's pass conditions are met. */
  public isCurrentCleared(): boolean {
    if (!this._current) return false;
    return this.determineWhetherCheckpointPassed(this._current);
  }

  public getCurrentEventHistory(): EventHistory | null {
    return this._current?.eventHistory ?? null;
  }

  public getPlayer() {
    if (!this.player)
      throw new TypeError(
        "玩家还没有初始化 The player has not been initialized",
      );
    return this.player;
  }

  public getCurrentLogStore() {
    return this._current?.logStore ?? null;
  }

  public getCurrentLevelId() {
    return this._current?.id ?? null;
  }

  /** 切换到下一关 */
  public goToNextLevel(): boolean {
    if (!this._current) return false;
    const nextId = this.resolveNextLevelId(this._current);
    if (!nextId || !this.levels.has(nextId)) return false;
    // Record the level we are leaving as completed, and persist it so progress
    // survives a restart.
    this.completedLevels.add(this._current.id);
    this.configStore.update({ completedLevels: [...this.completedLevels] });
    this.start(nextId);
    return true;
  }

  /** IDs of levels the player has actually finished this run. */
  public getCompletedLevelIds(): string[] {
    return [...this.completedLevels];
  }

  /** Objective ids already met on the current level (for save/restore). */
  public getCompletedObjectiveIds(): string[] {
    return this._current?.completedObjectiveIds() ?? [];
  }

  /** Restore a level's objective progress from a save (prevents re-rewarding). */
  public restoreObjectives(levelId: string, ids: string[]): void {
    this.levels.get(levelId)?.restoreObjectives(ids);
  }

  private loadEventsFor(level: Level): void {
    const builtinDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "resource",
      "events",
    );
    level.eventLoader.loadDir(builtinDir);

    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (!this.modRegistry.isValid(modName)) continue;
      if (!hasCapability(this.modRegistry.getModManifest(modName) ?? {}, "events")) {
        continue;
      }
      level.eventLoader.loadDir(this.modRegistry.getModEventsPath(modName));
    }
  }

  // 判断这个关卡是否通过
  public determineWhetherCheckpointPassed(level: Level) {
    const p = level.player ?? this.player;

    if (!p) throw new Error(`玩家未加载无法判断关卡${level.id}是否通过`);

    // A level with no explicit conditions is NOT automatically "passed"
    // (previously `every()` returned true for an empty list).
    if (level.nextLevelUnlock.length === 0) return false;

    return level.nextLevelUnlock.every((each) => each.customsClearance(p));
  }

  public getSnapshot = (): number => this.version;

  private notify(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  public restoreLevel(levelId: string, player: Player): void {
    const level = this.levels.get(levelId);
    if (!level) {
      this.eventBus.emit("level:loadFailed", { levelId });
      return;
    }
    this._current = level;
    level.player = player;
    // Apply any event-history blob handed over by a save load (levels own their
    // history, so it can only be restored once we've re-entered the level).
    if (this.pendingHistory) {
      level.eventHistory.restoreFromArchive(this.pendingHistory);
      level.eventHistory.save();
      this.pendingHistory = null;
    }
    if (level.eventCenter.getAllRanges().length === 0) {
      this.loadEventsFor(level);
    }
    this.modPluginLoader.setPlayer(player);
    this.lastPlayedLevelId = levelId;
    this.eventBus.emit("level:started", { levelId });
    this.notify();
  }

  /** Stash a saved per-level history blob to apply on the next restoreLevel. */
  public setPendingHistory(
    history: Parameters<EventHistory["restoreFromArchive"]>[0],
  ): void {
    this.pendingHistory = history;
  }
}
