import Player from "../world/Player.js";
import EventCenter from "../event/EventCenter.js";
import EventHistory from "../event/EventHistory.js";
import { IEventAlgorithm } from "../event/IEventAlgorithm.js";
import LogStore from "../core/store/LogStore.js";
import { LevelEventLoader } from "../event/LevelEventLoader.js";
import LevelCondition from "./registry/LevelCondition.js";

export interface LevelConfig {
    id: string;
    nameKey: string;
    descriptionKey: string;
    nextLevel: string | "none";
    difficultyIdentification: string
    nextLevelUnlock: LevelCondition[]
}

export default class Level {
    public readonly id: string;
    public readonly nameKey: string;
    public readonly descriptionKey: string;

    public readonly nextLevel: string | "none";
    public readonly nextLevelUnlock: LevelCondition[]

    public readonly eventCenter: EventCenter;
    public readonly eventHistory: EventHistory;
    public readonly algorithm: IEventAlgorithm;
    public readonly logStore: LogStore;
    public readonly eventLoader: LevelEventLoader;

    // 难度标识，用来表示难度，1就表示简单，这将有助于UI显示
    // 比如如果是1，那么这个关卡就会显示在UI界面的左边菜单的简单分类里面
    public readonly difficultyIdentification: string = 'easy'
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

        this.difficultyIdentification = config.difficultyIdentification
        this.nextLevelUnlock = config.nextLevelUnlock
        this.initialPlayerAttributes = initialPlayerAttributes
    }

    public update(): void {
        this.player.update();
        this.algorithm.trigger(this.player);
    }

    public reset(): void {
        this.eventHistory.reset();
        this.eventCenter.clear();
        this.algorithm.reset();
    }

    public dispose(): void {
        this.eventCenter.clear();
        this.eventHistory.reset();
        this.algorithm.reset();
    }
}
