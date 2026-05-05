import { Scope, Scoped } from "di-wise";
import LevelCondition from "./LevelCondition.js";
import z from "zod";

export interface LevelConditionEntry {
    ctor: new (...args: any[]) => LevelCondition;
    schema: z.ZodTypeAny;
}

@Scoped(Scope.Container)
export default class LevelConditionRegistry {
    public conditions = new Map<string, LevelConditionEntry>();

    public addCondition(
        id: string,
        ctor: new (...args: any[]) => LevelCondition,
        schema: z.ZodTypeAny,
    ): void {
        if (this.conditions.has(id))
            throw new Error(`通过条件 ${id} 已注册`);
        this.conditions.set(id, { ctor, schema });
    }

    public getCondition(id: string): LevelConditionEntry {
        const entry = this.conditions.get(id);
        if (!entry) throw new Error(`通过条件 ${id} 不存在`);
        return entry;
    }
}