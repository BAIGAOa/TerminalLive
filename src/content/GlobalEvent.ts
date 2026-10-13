export {};

declare global {
  interface EventMap {
    /**
     * 关卡开始。
     *
     * `resumed` 为真表示这是读档后重新进入已保存的关卡，而不是一条新生命的
     * 开始 —— 凡是按"root 关卡 = 新生命"来重置状态的监听者（信箱、AI 造人）
     * 都必须跳过它，否则会把存档刚还回来的内容当场清空。
     */
    "level:started": { levelId: string; resumed?: boolean };

    /** 玩家属性更新*/
    "player:updated": void;

    /** 事件执行完毕*/
    "incident:executed": { incidentId: string };

    /** 事件向玩家发起抉择 */
    "choice:offered": { incidentId: string };

    /** 玩家完成抉择 */
    "choice:resolved": { incidentId: string; optionId: string };

    /** 玩家与某个 NPC 互动 */
    "npc:interaction": { npcId: string; interactionId: string };

    /** 某个 NPC 自主做了某件事 */
    "npc:acted": { npcId: string; autonomyId: string };

    /** 玩家执行了一个行动 */
    "action:performed": { actionId: string };

    /** 一个回合结束（年龄推进） */
    "turn:ended": { age: number };

    /** 关卡通关 */
    "level:completed": { levelId: string; nextLevel: string };

    /** 关卡的一个目标达成（可选目标即勋章） */
    "level:objective": {
      levelId: string;
      objectiveId: string;
      optional: boolean;
    };

    /** 一生结束（死亡或自然终老） */
    "game:over": { reason: "death" | "complete"; age: number };

    /** 通用提示条 */
    "toast": { textKey: string; kind?: "info" | "success" | "warn" };

    /** 玩家入职某个职业（邮件系统据此让老板来一封信） */
    "career:joined": { careerId: string; rank: number };

    /** 玩家辞去某个职业 */
    "career:resigned": { careerId: string; rank: number };

    /** 玩家在职级阶梯上爬了一级 */
    "career:promoted": { careerId: string; rank: number };

    /** 玩家被解雇（不是主动辞职） */
    "career:fired": { careerId: string };

    /** 收到一封新的 AI 来信 */
    "mail:arrived": { npcId: string; demandsAnswer: boolean };

    /**
     * 玩家认识的人去世了。带着当时的好感度，因为哀伤的分量取决于
     * 失去的是谁 —— 点头之交和一个至亲不是一回事。
     */
    "npc:died": { npcId: string; affinity: number };

    /** 成就解锁 */
    "achievement:unlocked": { id: string; remindKey: string };

    /** 模组加载成功 */
    "moder:loadSuccess": { modName: string };

    /** 模组热重载完成 */
    "moder:reloaded": { count: number };

    /** 初始关卡恢复失败 */
    "level:loadFailed": { levelId: string };

    "archive:failedCreateFolder": { id: string };
  }
}
