import Player from "../world/Player.js";
import { PendingChoice } from "./PendingChoice.js";
import type { Incident } from "../world/Incident.js";
import type { SerializedPendingPostEvent } from "./PostEventScheduler.js";

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
    /** 读档时重新抛出一个等待抉择的事件 */
    restorePendingChoice?(
        incidentId: string,
        rangeKey: string,
        player: Player,
    ): void;
    /** 抛出一个非事件池来源的抉择（如 NPC 自主发起的邀请） */
    offerExternalChoice?(
        incident: Incident,
        rangeKey: string,
        player: Player,
    ): void;
    /** 调试：强制下一次抽取选中该事件（若它可被抽取），返回是否已排定 */
    forceNextEvent?(incidentId: string): boolean;

    /** 序列化尚未触发的后置事件队列（存档用，闭包无关） */
    snapshotPostEvents?(): SerializedPendingPostEvent[];
    /** 从存档恢复后置事件队列，边在触发时按内容重新解析 */
    restorePostEvents?(items: SerializedPendingPostEvent[]): void;
}
