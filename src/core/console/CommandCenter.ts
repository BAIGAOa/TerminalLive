import { Scope, Scoped } from "di-wise";

/** 指令执行成功时的国际化返回 */
export interface CommandResult {
  key: string;
  params?: Record<string, string | number>;
}

/** 指令函数：void = 使用默认成功消息；string = 原始消息（兼容）；CommandResult = i18n key */
export type Command = () => string | CommandResult | void;

@Scoped(Scope.Container)
export default class CommandCenter {
  private commands = new Map<string, Command>();

  public addCommand(id: string, command: Command): void {
    if (this.commands.has(id)) {
      throw new Error(
        `指令 "${id}" 已存在，不可重复注册。Command "${id}" already exists and cannot be re-registered.`,
      );
    }
    this.commands.set(id, command);
  }

  public deleteCommand(id: string): void {
    if (!this.commands.has(id)) {
      throw new Error(
        `无法删除不存在的指令 "${id}"。Cannot delete non-existent command "${id}".`,
      );
    }
    this.commands.delete(id);
  }

  public getCommand(id: string): Command {
    const cmd = this.commands.get(id);
    if (!cmd) {
      throw new Error(
        `指令 "${id}" 不存在。Command "${id}" does not exist.`,
      );
    }
    return cmd;
  }

  public getAllCommands(): ReadonlyMap<string, Command> {
    return this.commands;
  }
}