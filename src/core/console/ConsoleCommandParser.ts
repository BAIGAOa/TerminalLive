import { Scoped, Scope, inject } from "di-wise";
import CommandCenter, { Command, CommandResult } from "./CommandCenter.js";
import ConsoleStore from "./ConsoleStore.js";

@Scoped(Scope.Container)
export default class ConsoleCommandParser {
  private center: CommandCenter;
  private consoleStore: ConsoleStore;

  constructor() {
    this.center = inject(CommandCenter);
    this.consoleStore = inject(ConsoleStore);
  }

  private validateInstruction(instructionID: string): Command | null {
    try {
      return this.center.getCommand(instructionID);
    } catch {
      this.consoleStore.addCommandResult({
        type: "error",
        messageKey: "console.error.commandNotFound",
        messageParams: { id: instructionID },
      });
      return null;
    }
  }

  private performAction(command: Command, instructionID: string): void {
    try {
      const result = command();
      if (result === undefined || result === null) {
        this.consoleStore.addCommandResult({
          type: "success",
          messageKey: "console.cmd.defaultSuccess",
          messageParams: { id: instructionID },
        });
      } else if (typeof result === "string") {
        this.consoleStore.addCommandResult({
          type: "success",
          message: result,
        });
      } else {
        // result 已窄化为 CommandResult { key, params? }
        const cmdResult = result as CommandResult;
        this.consoleStore.addCommandResult({
          type: "success",
          messageKey: cmdResult.key,
          messageParams: cmdResult.params,
        });
      }
    } catch (err) {
      this.consoleStore.addCommandResult({
        type: "error",
        messageKey: "console.error.commandFailed",
        messageParams: { error: (err as Error).message },
      });
    }
  }

  public load(instructionID: string): void {
    const trimmed = instructionID.trim().toLowerCase();
    if (!trimmed) {
      this.consoleStore.addCommandResult({
        type: "error",
        messageKey: "console.error.emptyInput",
      });
      return;
    }
    const command = this.validateInstruction(trimmed);
    if (command) {
      this.performAction(command, trimmed);
    }
  }
}