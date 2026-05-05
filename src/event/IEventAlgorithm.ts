import Player from "../world/Player.js";

export interface IEventAlgorithm {
    /** 每回合被调用，尝试在本关卡中触发事件 */
    trigger(player: Player): void;
    /** 重置算法状态（关卡切换或重新开始时调用） */
    reset(): void;
}