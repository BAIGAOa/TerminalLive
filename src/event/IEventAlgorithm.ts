import Player from "../world/Player.js";
import { PendingChoice } from "./PendingChoice.js";

export interface IEventAlgorithm {
    /** 每回合被调用，尝试在本关卡中触发事件 */
    trigger(player: Player): void;
    /** 重置算法状态（关卡切换或重新开始时调用） */
    reset(): void;

    /** 是否存在等待玩家抉择的事件 */
    hasPendingChoice?(): boolean;
    /** 取得当前等待抉择的事件 */
    getPendingChoice?(): PendingChoice | null;
    /** 玩家选择了某个分支，结算并返回是否成功 */
    resolveChoice?(optionId: string, player: Player): boolean;
}
