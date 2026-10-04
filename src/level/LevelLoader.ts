import { container, inject } from "../Container.js";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import Level, { LevelConfig } from "./Level.js";
import Player from "../world/Player.js";
import EventCenter from "../event/EventCenter.js";
import EventHistory from "../event/EventHistory.js";
import LogStore from "../core/store/LogStore.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";
import EventTypeRegistry from "../core/mod/EventTypeRegistry.js";
import { LevelEventLoader } from "../event/LevelEventLoader.js";
import { levelConfigSchema, LevelJsonConfig } from "./LevelConfigSchema.js";
import IncidentFilter from "../event/IncidentFilter.js";
import AlgorithmRegistry from "../core/registry/AlgorithmRegistry.js";
import FilterRegistry from "../core/registry/FilterRegistry.js";
import LevelConditionRegistry from "../core/registry/LevelConditionRegistry.js";
import WorldState from "../world/chronicle/WorldState.js";
import PressureState from "../world/pressures/PressureState.js";
import WeatherState from "../world/weather/WeatherState.js";
import LevelCondition from "./LevelCondition.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

export default class LevelLoader {
  private algorithmRegistry: AlgorithmRegistry;
  private filterRegistry: FilterRegistry;
  private modPluginLoader: ModPluginLoader;
  private eventTypeRegistry: EventTypeRegistry;

  public readonly levelsDir: string;

  private conditionCenter: LevelConditionRegistry;

  constructor() {
    this.algorithmRegistry = inject(AlgorithmRegistry);
    this.filterRegistry = inject(FilterRegistry);
    this.modPluginLoader = inject(ModPluginLoader);
    this.eventTypeRegistry = inject(EventTypeRegistry);
    this.conditionCenter = inject(LevelConditionRegistry);
    this.levelsDir = join(_dirname, "..", "..", "resource", "levels");
  }

  public loadAll(player: Player): Level[] {
    const levels: Level[] = [];
    let files: string[];
    try {
      files = readdirSync(this.levelsDir).filter((f) => extname(f) === ".json");
    } catch {
      console.warn(`关卡目录 ${this.levelsDir} 不存在或无法读取`);
      return [];
    }
    for (const file of files) {
      const level = this.loadFromFile(join(this.levelsDir, file), player);
      if (level) levels.push(level);
    }
    return levels;
  }

  public loadFromFile(filePath: string, player: Player): Level | null {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`解析关卡文件 ${filePath} 失败:`, (err as Error).message);
      return null;
    }
    const parsed = levelConfigSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `校验关卡文件 ${filePath} 失败:`,
        parsed.error.issues.map((i) => i.message).join(", "),
      );
      return null;
    }
    return this.buildLevel(parsed.data, player);
  }

  /** Build one condition instance from a `{ type, params }` config entry. */
  private buildCondition(
    type: string,
    params: Record<string, unknown>,
  ): LevelCondition {
    const entry = this.conditionCenter.get(type);
    const data = entry.schema.parse(params);
    return new entry.ctor(data);
  }

  private buildLevel(config: LevelJsonConfig, player: Player): Level {
    // `onEnter.setPlayer` is deliberately NOT applied here — levels share one
    // player instance, so applying at load time would let the last-loaded
    // level's start state win. It is applied in LevelManager.start instead.
    const eventCenter = new EventCenter();
    // One shared history for the whole life (see Level.reset) so once-per-life
    // events can't refire after a stage transition.
    const eventHistory = container.resolve(EventHistory);
    const logStore = new LogStore();

    // 构建过滤器链
    const filters: IncidentFilter[] = [
      this.filterRegistry.create("blocked"),
      this.filterRegistry.create("predecessor"),
      this.filterRegistry.create("once"),
      // World/pressure/weather gates were defined but never wired into the
      // chain, so era/faction/weather-gated events fired unconditionally.
      this.filterRegistry.create("world"),
      this.filterRegistry.create("pressure"),
      this.filterRegistry.create("weather"),
      ...config.extraFilters.map((name) => this.filterRegistry.create(name)),
    ];

    // 构建算法
    const algorithm = this.algorithmRegistry.get(config.algorithm)({
      eventCenter,
      logStore,
      eventHistory,
      modPluginLoader: this.modPluginLoader,
      filters,
      world: container.resolve(WorldState),
      pressures: container.resolve(PressureState),
      weather: container.resolve(WeatherState),
    });

    // 构建事件加载器
    const eventLoader = new LevelEventLoader(
      eventCenter,
      this.eventTypeRegistry,
    );

    const conditions = config.nextLevelUnlock.map((each) =>
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

    const levelConfig: LevelConfig = {
      id: config.id,
      nextLevelUnlock: conditions,
      objectives,
      nextBranches,
      nameKey: config.nameKey,
      descriptionKey: config.descriptionKey,
      nextLevel: config.nextLevel,
      act: config.act,
      difficultyIdentification: config.difficultyIdentification,
    };

    return new Level(
      levelConfig,
      player,
      algorithm,
      eventCenter,
      eventHistory,
      logStore,
      eventLoader,
      config.onEnter?.setPlayer as Record<string, unknown> | undefined,
    );
  }

  public loadDir(dirPath: string, player: Player): Level[] {
    const levels: Level[] = [];
    let files: string[];
    try {
      files = readdirSync(dirPath).filter((f) => extname(f) === ".json");
    } catch {
      // 目录不存在是常见情况（不是每个模组都有关卡）
      return [];
    }
    for (const file of files) {
      const level = this.loadFromFile(join(dirPath, file), player);
      if (level) levels.push(level);
    }
    return levels;
  }
}
