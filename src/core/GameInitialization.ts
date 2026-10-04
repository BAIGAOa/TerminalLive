import { inject } from "../Container.js";
import Game from "./Game.js";
import ConfigStore from "./store/ConfigStore.js";
import Player from "../world/Player.js";
import ModLoader from "./mod/ModLoader.js";
import EventTypes from "./mod/EventTypes.js";
import ModPluginLoader from "./mod/ModPluginLoader.js";
import ConsoleStore from "./console/ConsoleStore.js";
import { container } from "../Container.js";
import EventHistory from "../event/EventHistory.js";
import { ArchiveManager } from "./archive/ArchiveManager.js";
import AutoSave from "./archive/AutoSave.js";
import { registerBuiltinRegistrations } from "../level/BuiltinRegistrations.js";
import LevelManager from "../level/LevelManager.js";
import Conditions from "../content/Conditions.js";
import GameStatus from "../content/GameStatus.js";
import ThemeParser from "./theme/ThemeParser.js";
import ThemeManager from "./theme/ThemeManager.js";
import { VersionProvider } from "./version/VersionProvider.js";
import Effects from "../content/Effects.js";
import Actions from "../content/Actions.js";
import Traits from "../content/Traits.js";
import World from "../content/World.js";
import Weather from "../content/Weather.js";
import RelationshipContent from "../content/RelationshipContent.js";
import PressureLoader from "../world/pressures/PressureLoader.js";
import ItemLoader from "../world/items/ItemLoader.js";
import NpcLoader from "../world/relationships/NpcLoader.js";
import CareerLoader from "../world/careers/CareerLoader.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import ModMonitor from "./mod/ModMonitor.js";
import { hasCapability } from "./mod/capabilities.js";
import AchievementManager from "../achievement/AchievementManager.js";
import AchievementResolver from "../achievement/AchievementResolver.js";
import LineageStore from "./store/LineageStore.js";
import LineageManager from "../world/lineage/LineageManager.js";
import LevelRecordsStore from "./store/LevelRecordsStore.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export default class GameInitialization {
  public configStore: ConfigStore;
  public game: Game;
  public modLoader: ModLoader;
  public modRegistry: ModMonitor;
  public player!: Player;
  public eventHistory: EventHistory;
  public archiveManager: ArchiveManager;
  public modPluginLoader: ModPluginLoader;
  public levelManager: LevelManager;

  constructor() {
    this.configStore = inject(ConfigStore);
    this.game = inject(Game);
    this.modLoader = inject(ModLoader);
    this.modRegistry = inject(ModMonitor);
    this.eventHistory = inject(EventHistory);
    this.archiveManager = inject(ArchiveManager);
    this.modPluginLoader = inject(ModPluginLoader);
    this.levelManager = inject(LevelManager);
  }

  private async configurationInitialization() {
    await this.configStore.init();
  }

  private restoreLevelProgress() {
    const lastLevelId = this.configStore.getSnapshot().lastLevelId;
    if (
      lastLevelId &&
      lastLevelId !== "none" &&
      // Only resume when an auto-save actually exists — otherwise a finished
      // life (cleared slot) would boot into its last level with default stats.
      container.resolve(AutoSave).exists() &&
      this.levelManager.getAllLevels().has(lastLevelId)
    ) {
      // Resume the saved life on its level WITHOUT re-applying onEnter
      // (restoreLevel skips it), so the player's saved state is kept.
      this.levelManager.restoreLevel(lastLevelId, this.player);
    }
  }

  /**
   * Load the auto-saved life in place (full player + world + history state).
   * Returns the pending choice to re-offer once the level is re-entered.
   */
  private restoreAutoSave(): { incidentId: string; rangeKey: string } | null {
    const data = container.resolve(AutoSave).load();
    return data?.pendingChoice ?? null;
  }

  private loadPlayer(): void {
    this.player = new Player(this.configStore.getPlayerConfig());
  }

  private loadContent(): void {
    EventTypes.registerAll();
    // Events are loaded per-level by LevelManager.loadEventsFor (built-in +
    // enabled mods), so the global ModLoader pass is intentionally skipped.
    Conditions.load();
    GameStatus.load();
    Effects.load();
    Actions.load();
    Traits.load();
    World.load();
    Weather.load();
    container.resolve(RelationshipContent).load();
    container.resolve(PressureLoader).loadBuiltin();

    const itemLoader = container.resolve(ItemLoader);
    const npcLoader = container.resolve(NpcLoader);
    itemLoader.loadBuiltin();
    npcLoader.loadBuiltin();
    container.resolve(CareerLoader).loadBuiltin();

    // Enabled mods may ship extra items / npcs / hidden-score axes+rules.
    const pressureLoader = container.resolve(PressureLoader);
    for (const modName of this.configStore.getEnabledMods()) {
      if (!this.modRegistry.isValid(modName)) continue;
      const manifest = this.modRegistry.getModManifest(modName);
      const dir = this.modRegistry.getModPath(modName);
      // Capability-gated: a mod only gets the content it declared.
      if (hasCapability(manifest ?? {}, "items")) {
        itemLoader.loadDir(join(dir, "items"));
      } else if (manifest?.capabilities) {
        console.warn(`[Mod] "${modName}" 未声明 items 能力，跳过 items/`);
      }
      if (hasCapability(manifest ?? {}, "npcs")) {
        npcLoader.loadDir(join(dir, "npcs"));
      }
      if (hasCapability(manifest ?? {}, "world")) {
        pressureLoader.loadModDir(dir);
      }
    }
  }

  private initThemes(): void {
    const themeParser = container.resolve(ThemeParser);
    themeParser.load();

    const themeManager = container.resolve(ThemeManager);
    const savedTheme = this.configStore.getTheme();
    if (themeManager.getCurrentId() !== savedTheme) {
      try {
        themeManager.setCurrent(savedTheme);
      } catch {
        themeManager.setCurrent("default");
        this.configStore.setTheme("default");
      }
    }
  }

  private async initAchievementSystem() {
    const achievementResolver = container.resolve(AchievementResolver);
    const achievementManager = container.resolve(AchievementManager);

    const builtinAchDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "resource",
      "achievement",
    );
    achievementResolver.load(builtinAchDir);

    const enabledMods = this.configStore.getEnabledMods();
    for (const modName of enabledMods) {
      if (this.modRegistry.isValid(modName)) {
        const modAchPath = this.modRegistry.getModAchievementsPath(modName);
        achievementResolver.load(modAchPath);
      }
    }

    await achievementManager.load();
    achievementManager.bindPlayer(this.player);
  }

  public async init() {
    container.resolve(ConsoleStore);
    container.resolve(VersionProvider);
    await this.configurationInitialization();
    this.loadPlayer();
    this.eventHistory.load();
    this.loadContent();

    // Seed starting relationship affinities now that NPCs are loaded (the
    // player is constructed before content, so this can't happen in the ctor).
    this.player.seedRelationships(container.resolve(NpcRegistry).getAll());

    registerBuiltinRegistrations();
    const levelManager = container.resolve(LevelManager);
    levelManager.setPlayer(this.player);

    this.modPluginLoader.setPlayer(this.player);
    this.modPluginLoader.loadEnabled();
    // Let plugins react to the player being created (after they've loaded).
    this.modPluginLoader.firePlayerCreated(this.player);
    levelManager.loadAllLevels();

    this.initThemes();

    await this.initAchievementSystem();

    // Load the family line and start listening for life-end captures.
    await container.resolve(LineageStore).init();
    container.resolve(LineageManager).bindPlayer(this.player);
    await container.resolve(LevelRecordsStore).init();

    // Resume a life in progress: apply the full auto-save first (it sets the
    // current level + player + world), then re-enter that level, then re-offer
    // any choice that was awaiting a decision at quit time.
    const pendingChoice = this.restoreAutoSave();
    this.restoreLevelProgress();
    if (pendingChoice) {
      this.levelManager.restorePendingChoice(
        pendingChoice.incidentId,
        pendingChoice.rangeKey,
      );
      // Re-enter emitted `level:started`, which auto-saved with a null choice;
      // persist again so the awaiting choice survives another quit.
      container.resolve(AutoSave).save();
    }
    this.levelManager.initCompletedLevels(
      this.configStore.getSnapshot().completedLevels,
    );
    return this;
  }
}