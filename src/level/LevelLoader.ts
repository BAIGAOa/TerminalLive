import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Scope, Scoped, inject } from "di-wise";
import Level, { LevelConfig } from "./Level.js";
import Player from "../world/Player.js";
import EventCenter from "../event/EventCenter.js";
import EventHistory from "../event/EventHistory.js";
import LogStore from "../core/store/LogStore.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";
import EventTypeRegistry from "../core/mod/EventTypeRegistry.js";
import AlgorithmRegistry from "../event/AlgorithmRegistry.js";
import FilterRegistry from "../event/registry/FilterRegistry.js";
import { LevelEventLoader } from "../event/LevelEventLoader.js";
import { levelConfigSchema, LevelJsonConfig } from "./LevelConfigSchema.js";
import IncidentFilter from "../event/IncidentFilter.js";
import LevelConditionRegistry from "./registry/LevelConditionRegistry.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

@Scoped(Scope.Container)
export default class LevelLoader {
    private algorithmRegistry: AlgorithmRegistry;
    private filterRegistry: FilterRegistry;
    private modPluginLoader: ModPluginLoader;
    private eventTypeRegistry: EventTypeRegistry;

    public readonly levelsDir: string;

    private conditionCenter: LevelConditionRegistry

    constructor() {
        this.algorithmRegistry = inject(AlgorithmRegistry);
        this.filterRegistry = inject(FilterRegistry);
        this.modPluginLoader = inject(ModPluginLoader);
        this.eventTypeRegistry = inject(EventTypeRegistry);
        this.conditionCenter = inject(LevelConditionRegistry)
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

    private buildLevel(config: LevelJsonConfig, player: Player): Level {
        if (config.onEnter?.setPlayer) {
            player.applyAttributes(config.onEnter.setPlayer as any);
        }

        const eventCenter = new EventCenter();
        const eventHistory = new EventHistory();
        const logStore = new LogStore();

        // 构建过滤器链
        const filters: IncidentFilter[] = [
            this.filterRegistry.create("blocked"),
            this.filterRegistry.create("predecessor"),
            this.filterRegistry.create("once"),
            ...config.extraFilters.map((name) => this.filterRegistry.create(name)),
        ];

        // 构建算法
        const algorithm = this.algorithmRegistry.get(config.algorithm)({
            eventCenter,
            logStore,
            eventHistory,
            modPluginLoader: this.modPluginLoader,
            filters,
        });

        // 构建事件加载器
        const eventLoader = new LevelEventLoader(eventCenter, this.eventTypeRegistry);

        const conditions = config.nextLevelUnlock.map(each => {
            const entry = this.conditionCenter.getCondition(each.type)
            // 为了不引入复杂的类型体操，况且类型体操也很不灵活
            // 但当前的schema验证也已经够用了，模组开发者只需要确保schema
            // 和构造函数的参数一致，就可以了
            const data = entry.schema.parse(each.params)
            return new entry.ctor(data)
        })

        const levelConfig: LevelConfig = {
            id: config.id,
            nextLevelUnlock: conditions,
            nameKey: config.nameKey,
            descriptionKey: config.descriptionKey,
            nextLevel: config.nextLevel,
            difficultyIdentification: config.difficultyIdentification
        };

        return new Level(levelConfig, player, algorithm, eventCenter, eventHistory, logStore, eventLoader, config.onEnter?.setPlayer as Record<string, unknown> | undefined
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
