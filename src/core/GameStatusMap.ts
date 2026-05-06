import { Scope, Scoped } from "di-wise";
import React from "react";

@Scoped(Scope.Container)
export default class GameStatusMap {
  private statusMap = new Map<string, (props?: any) => React.ReactNode>();

  public addStatus(id: string, renderFn: (props?: any) => React.ReactNode) {
    if (this.statusMap.has(id))
      throw new Error(
        `游戏视图组件已经注册过了ID为 The Game View component has already been registered with ID: ${id}`,
      );
    this.statusMap.set(id, renderFn);
  }

  public removeStatus(id: string) {
    if (!this.statusMap.has(id))
      throw new Error(
        `无法删除不存在的游戏视图组件ID为 Cannot delete nonexistent Game View component ID: ${id}`,
      );
    this.statusMap.delete(id);
  }

  public getStatus(id: string): ((props?: any) => React.ReactNode) | undefined {
    return this.statusMap.get(id);
  }

  public getAll() {
    return this.statusMap;
  }
}
