import { Scope, Scoped } from "di-wise";
import { Key } from "ink";

export type KeyHandler = (input: string, key: Key) => boolean;

@Scoped(Scope.Container)
export class KeyboardManager {
  private stack: KeyHandler[] = [];
  private defaultHandler: KeyHandler | null = null;

  // 设置默认处理器 始终在栈底 不会被 push/remove 影响
  public setDefaultHandler(handler: KeyHandler): void {
    this.defaultHandler = handler;
  }

  public push(handler: KeyHandler): void {
    this.stack.push(handler);
  }

  public remove(handler: KeyHandler): void {
    this.stack = this.stack.filter((h) => h !== handler);
  }

  public handle(input: string, key: Key): boolean {
    // 先遍历栈
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i](input, key)) return true;
    }
    // 最后交给默认处理器
    if (this.defaultHandler) {
      return this.defaultHandler(input, key);
    }
    return false;
  }
}
