export {};

declare global {
  interface EventMap {
    /** 关卡开始 */
    "level:started": { levelId: string };

    /** 玩家属性更新*/
    "player:updated": void;

    /** 事件执行完毕*/
    "incident:executed": { incidentId: string };

    /** 成就解锁 */
    "achievement:unlocked": { id: string; remindKey: string };

    /** 模组加载成功 */
    "moder:loadSuccess": { modName: string };

    /** 初始关卡恢复失败 */
    "level:loadFailed": { levelId: string };

    "archive:failedCreateFolder": { id: string };
  }
}
