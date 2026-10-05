import { inject } from "../Container.js";
import Game from "./Game.js";
import ConfigStore from "./store/ConfigStore.js";
import Player from "../world/Player.js";
import EventTypes from "./mod/EventTypes.js";
import ModPluginLoader from "./mod/ModPluginLoader.js";
import ConsoleStore from "./console/ConsoleStore.js";
import { container } from "../Container.js";
import EventHistory from "../event/EventHistory.js";
import { ArchiveManager } from "./archive/ArchiveManager.js";
import AutoSave from "./archive/AutoSave.js";
import { registerBuiltinRegistrations } from "../worlds/BuiltinRegistrations.js";
import WorldManager from "../worlds/WorldManager.js";
import Conditions from "../content/Conditions.js";
import ThemeParser from "./theme/ThemeParser.js";
import ThemeManager from "./theme/ThemeManager.js";
import { VersionProvider } from "./version/VersionProvider.js";
import Effects from "../content/Effects.js";
import Actions from "../content/Actions.js";
import Traits from "../content/Traits.js";
import Chronicle from "../content/Chronicle.js";
import Weather from "../content/Weather.js";
import RelationshipContent from "../content/RelationshipContent.js";
import PressureLoader from "../world/pressures/PressureLoader.js";
import ItemLoader from "../world/items/ItemLoader.js";
import NpcLoader from "../world/relationships/NpcLoader.js";
import CareerLoader from "../world/careers/CareerLoader.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import NpcTypes from "../world/relationships/NpcTypes.js";
import WorldContentLoader from "../worlds/WorldContentLoader.js";
import WorldRuleLoader from "../world/rules/WorldRuleLoader.js";
import WorldRuleRegistry from "../world/rules/WorldRuleRegistry.js";
import BuiltinPluginRegistry from "./mod/BuiltinPlugin.js";
import ModMonitor from "./mod/ModMonitor.js";
import { hasCapability } from "./mod/capabilities.js";
import AchievementManager from "../achievement/AchievementManager.js";
import AchievementResolver from "../achievement/AchievementResolver.js";
import LineageStore from "./store/LineageStore.js";
import LineageManager from "../world/lineage/LineageManager.js";
import WorldRecordsStore from "./store/WorldRecordsStore.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export default class GameInitialization {
  public configStore: ConfigStore;
  public game: Game;
  public modRegistry: ModMonitor;
  public player!: Player;
  public eventHistory: EventHistory;
  public archiveManager: ArchiveManager;
  public modPluginLoader: ModPluginLoader;
  public levelManager: WorldManager;

  constructor() {
    this.configStore = inject(ConfigStore);
    this.game = inject(Game);
    this.modRegistry = inject(ModMonitor);
    this.eventHistory = inject(EventHistory);
    this.archiveManager = inject(ArchiveManager);
    this.modPluginLoader = inject(ModPluginLoader);
    this.levelManager = inject(WorldManager);
  }

  private async configurationInitialization() {
    await this.configStore.init();
  }

  private restoreWorldProgress() {
    const snap = this.configStore.getSnapshot();
    const lastWorldId = snap.lastWorldId ?? snap.lastLevelId;
    if (
      lastWorldId &&
      lastWorldId !== "none" &&
      // Only resume when an auto-save actually exists — otherwise a finished
      // life (cleared slot) would boot into its last world with default stats.
      container.resolve(AutoSave).exists() &&
      this.levelManager.getAllWorlds().has(lastWorldId)
    ) {
      // Resume the saved life in its world WITHOUT re-applying startPlayer
      // (restoreWorld skips it), so the player's saved state is kept.
      this.levelManager.restoreWorld(lastWorldId, this.player);
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
    // NPC archetype classes must exist before any NPC JSON is parsed.
    NpcTypes.registerAll();
    // Events are loaded per-level by WorldManager.loadEventsFor (built-in +
    // enabled mods); there is no global event-loader pass.
    Conditions.load();
    // Status-view components are registered by the UI layer (registerStatusViews,
    // called from main.tsx) so content never imports React components.
    Effects.load();
    Actions.load();
    Traits.load();
    Chronicle.load();
    Weather.load();
    container.resolve(RelationshipContent).load();
    container.resolve(PressureLoader).loadBuiltin();
    // The global world-rule library; worlds select by id (worldRules).
    container.resolve(WorldRuleLoader).loadBuiltin();
    // Built-in plugins (resource/plugins) — toggleable extra content.
    const builtins = container.resolve(BuiltinPluginRegistry);
    builtins.load();
    const ruleRegistry = container.resolve(WorldRuleRegistry);
    for (const rule of builtins.allWorldRules()) {
      if (!ruleRegistry.has(rule.id)) ruleRegistry.register(rule.id, rule);
    }

    const itemLoader = container.resolve(ItemLoader);
    const npcLoader = container.resolve(NpcLoader);
    itemLoader.loadBuiltin();
    npcLoader.loadBuiltin();
    container.resolve(CareerLoader).loadBuiltin();

    // Enabled mods may ship extra items / hidden-score axes+rules. Mod NPCs are
    // loaded separately (see loadModNpcContent) *after* their plugin types are
    // registered, so a mod JSON with `type: "xxx"` resolves correctly.
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
      if (hasCapability(manifest ?? {}, "world")) {
        pressureLoader.loadModDir(dir);
      }
    }
  }

  /**
   * Load mod `npcs/` directories. Runs *after* `loadEnabled()`, so any NPC
   * types the mods registered are already in the type registry when their JSON
   * is parsed.
   */
  private loadModNpcContent(): void {
    const npcLoader = container.resolve(NpcLoader);
    for (const modName of this.configStore.getEnabledMods()) {
      if (!this.modRegistry.isValid(modName)) continue;
      if (!hasCapability(this.modRegistry.getModManifest(modName) ?? {}, "npcs")) {
        continue;
      }
      npcLoader.loadModDir(join(this.modRegistry.getModPath(modName), "npcs"));
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

    registerBuiltinRegistrations();
    const levelManager = container.resolve(WorldManager);
    levelManager.setPlayer(this.player);

    this.modPluginLoader.setPlayer(this.player);
    this.modPluginLoader.loadEnabled();
    // Mod NPC JSON is parsed only after the mods registered their types.
    this.loadModNpcContent();
    // Capture the built-in + mod content baseline that every world layers over.
    container.resolve(WorldContentLoader).captureBase();
    // Seed starting relationship affinities now that every NPC (built-in +
    // mod) is loaded; the player is constructed before content, so this can't
    // happen in its constructor.
    this.player.seedRelationships(container.resolve(NpcRegistry).getAll());
    // Let plugins react to the player being created (after they've loaded).
    this.modPluginLoader.firePlayerCreated(this.player);
    levelManager.loadAllWorlds();

    this.initThemes();

    await this.initAchievementSystem();

    // Load the family line and start listening for life-end captures.
    await container.resolve(LineageStore).init();
    container.resolve(LineageManager).bindPlayer(this.player);
    await container.resolve(WorldRecordsStore).init();

    // Resume a life in progress: apply the full auto-save first (it sets the
    // current level + player + world), then re-enter that level, then re-offer
    // any choice that was awaiting a decision at quit time.
    const pendingChoice = this.restoreAutoSave();
    this.restoreWorldProgress();
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