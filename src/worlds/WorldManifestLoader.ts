import { container, inject } from "../Container.js";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import World, { WorldManifest } from "./World.js";
import Player from "../world/Player.js";
import EventCenter from "../event/EventCenter.js";
import EventHistory from "../event/EventHistory.js";
import LogStore from "../core/store/LogStore.js";
import PluginHost from "../core/plugin/PluginHost.js";
import EventTypeRegistry from "../core/mod/EventTypeRegistry.js";
import { WorldEventLoader } from "../event/WorldEventLoader.js";
import { worldManifestSchema, WorldJsonConfig } from "./WorldManifestSchema.js";
import IncidentFilter from "../event/IncidentFilter.js";
import AlgorithmRegistry from "../core/registry/AlgorithmRegistry.js";
import FilterRegistry from "../core/registry/FilterRegistry.js";
import WorldConditionRegistry from "../core/registry/WorldConditionRegistry.js";
import WorldState from "../world/chronicle/WorldState.js";
import PressureState from "../world/pressures/PressureState.js";
import WeatherState from "../world/weather/WeatherState.js";
import WorldCondition from "./WorldCondition.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/**
 * Loads `world.json` manifests. Built-in worlds live in `resource/worlds/<id>/`;
 * mod worlds come from a mod's `worlds/` dir (each a subdir with its own
 * `world.json`). A world's other content dirs (events/, npcs/, …) are read at
 * life-start by {@link WorldContentLoader}.
 */
export default class WorldManifestLoader {
  private algorithmRegistry: AlgorithmRegistry;
  private filterRegistry: FilterRegistry;
  private pluginHost: PluginHost;
  private eventTypeRegistry: EventTypeRegistry;

  public readonly worldsDir: string;

  private conditionCenter: WorldConditionRegistry;

  constructor() {
    this.algorithmRegistry = inject(AlgorithmRegistry);
    this.filterRegistry = inject(FilterRegistry);
    this.pluginHost = inject(PluginHost);
    this.eventTypeRegistry = inject(EventTypeRegistry);
    this.conditionCenter = inject(WorldConditionRegistry);
    this.worldsDir = join(_dirname, "..", "..", "resource", "worlds");
  }

  /** Every built-in world (one per `<id>/world.json`). */
  public loadAll(player: Player): World[] {
    const worlds: World[] = [];
    let subdirs: string[];
    try {
      subdirs = readdirSync(this.worldsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      console.warn(`世界目录 ${this.worldsDir} 不存在或无法读取`);
      return [];
    }
    for (const name of subdirs) {
      const dir = join(this.worldsDir, name);
      const world = this.loadFromFile(join(dir, "world.json"), player, dir);
      if (world) worlds.push(world);
    }
    return worlds;
  }

  public loadFromFile(
    filePath: string,
    player: Player,
    contentDir: string,
  ): World | null {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`解析世界文件 ${filePath} 失败:`, (err as Error).message);
      return null;
    }
    const parsed = worldManifestSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `校验世界文件 ${filePath} 失败:`,
        parsed.error.issues.map((i) => i.message).join(", "),
      );
      return null;
    }
    return this.buildWorld(parsed.data, player, contentDir);
  }

  /** Build one condition instance from a `{ type, params }` config entry. */
  private buildCondition(
    type: string,
    params: Record<string, unknown>,
  ): WorldCondition {
    const entry = this.conditionCenter.get(type);
    const data = entry.schema.parse(params);
    return new entry.ctor(data);
  }

  private buildWorld(
    config: WorldJsonConfig,
    player: Player,
    contentDir: string,
  ): World {
    // `startPlayer` is deliberately NOT applied here — all worlds share one
    // player instance, so applying at load time would let the last-loaded
    // world's start state win. It is applied in WorldManager.start instead.
    const eventCenter = new EventCenter();
    // One shared history for the whole life (see World.reset) so once-per-life
    // events can't refire.
    const eventHistory = container.resolve(EventHistory);
    const logStore = new LogStore();

    const filters: IncidentFilter[] = [
      this.filterRegistry.create("blocked"),
      this.filterRegistry.create("predecessor"),
      this.filterRegistry.create("once"),
      this.filterRegistry.create("world"),
      this.filterRegistry.create("pressure"),
      this.filterRegistry.create("weather"),
      ...config.extraFilters.map((name) => this.filterRegistry.create(name)),
    ];

    const algorithm = this.algorithmRegistry.get(config.algorithm)({
      eventCenter,
      logStore,
      eventHistory,
      pluginHost: this.pluginHost,
      filters,
      world: container.resolve(WorldState),
      pressures: container.resolve(PressureState),
      weather: container.resolve(WeatherState),
    });

    const eventLoader = new WorldEventLoader(eventCenter, this.eventTypeRegistry);

    // Victory conditions: new `completionConditions`, else the legacy alias.
    const conditionSpecs =
      config.completionConditions.length > 0
        ? config.completionConditions
        : config.nextLevelUnlock;
    const conditions = conditionSpecs.map((each) =>
      this.buildCondition(each.type, each.params),
    );

    const objectives = config.objectives.map((each) => ({
      id: each.id,
      labelKey: each.labelKey,
      optional: each.optional,
      condition: this.buildCondition(each.condition.type, each.condition.params),
      reward: each.reward,
    }));

    const nextBranches = (config.nextLevels ?? []).map((branch) => ({
      levelId: branch.levelId,
      requires: branch.requires.map((r) => this.buildCondition(r.type, r.params)),
    }));

    const unlockConditions = config.unlockConditions.map((each) =>
      this.buildCondition(each.type, each.params),
    );

    const startPlayer =
      Object.keys(config.startPlayer).length > 0
        ? config.startPlayer
        : config.onEnter?.setPlayer ?? {};

    const manifest: WorldManifest = {
      id: config.id,
      nameKey: config.nameKey,
      descriptionKey: config.descriptionKey,
      icon: config.icon,
      tags: config.tags,
      contentVersion: config.contentVersion,
      startEra: config.startEra,
      startRegion: config.startRegion,
      eraYearOffset: config.eraYearOffset,
      selfContained: config.selfContained,
      worldRules: config.worldRules,
      contentDir,
      unlockRequires: config.unlockRequires,
      unlockConditions,
      nextLevelUnlock: conditions,
      objectives,
      nextBranches,
      nextLevel: config.nextLevel,
      act: config.act,
      difficultyIdentification: config.difficultyIdentification,
    };

    return new World(
      manifest,
      player,
      algorithm,
      eventCenter,
      eventHistory,
      logStore,
      eventLoader,
      startPlayer,
    );
  }

  /** Load mod worlds: each subdir with a `world.json`, or loose `*.json`. */
  public loadDir(dirPath: string, player: Player): World[] {
    const worlds: World[] = [];
    let entries;
    try {
      entries = readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }
    for (const entry of entries) {
      const world = entry.isDirectory()
        ? this.loadFromFile(join(dirPath, entry.name, "world.json"), player, join(dirPath, entry.name))
        : entry.name.endsWith(".json")
          ? this.loadFromFile(join(dirPath, entry.name), player, dirPath)
          : null;
      if (world) worlds.push(world);
    }
    return worlds;
  }
}
