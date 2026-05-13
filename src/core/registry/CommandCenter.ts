import { Scope, Scoped } from "di-wise";
import BaseRegistry from "./BaseRegistry.js";

export interface CommandResult {
  key: string;
  params?: Record<string, string | number>;
}

export type Command = () => string | CommandResult | void;

@Scoped(Scope.Container)
export default class CommandCenter extends BaseRegistry<Command> {
  public getCommandIds(): string[] {
    return this.getKeys();
  }
}