import { Scope, Scoped } from "di-wise";

@Scoped(Scope.Container)
export default class KeysCenter {
    // 改为扁平结构：operateId -> 执行函数
    private operations: Map<string, () => any> = new Map();

    /**
     * 注册一个操作
     * @param operateId 操作标识符（如 'start-game'）
     * @param fn 执行函数
     */
    public register(operateId: string, fn: () => any): void {
        if (this.operations.has(operateId)) {
            throw new Error(`操作 "${operateId}" 已存在，不可重复注册`);
        }
        this.operations.set(operateId, fn);
    }

    /**
     * 获取操作函数
     * @param operateId 操作标识符
     */
    public getOperation(operateId: string): () => any {
        const fn = this.operations.get(operateId);
        if (!fn) {
            throw new Error(`未找到操作 "${operateId}"`);
        }
        return fn;
    }

    /**
     * 检查操作是否存在
     */
    public hasOperation(operateId: string): boolean {
        return this.operations.has(operateId);
    }

   
}