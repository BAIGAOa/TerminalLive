import { inject } from "../../Container.js";
import ConsoleStore from "./ConsoleStore.js";
import CommandCenter, {
  Command,
  CommandResult,
} from "../registry/CommandCenter.js";

export default class ConsoleCommandParser {
  private center: CommandCenter;
  private consoleStore: ConsoleStore;

  constructor() {
    this.center = inject(CommandCenter);
    this.consoleStore = inject(ConsoleStore);
  }

  private validateInstruction(instructionID: string): Command | null {
    try {
      return this.center.get(instructionID);
    } catch {
      this.consoleStore.addCommandResult({
        type: "error",
        messageKey: "console.error.commandNotFound",
        messageParams: { id: instructionID },
      });
      return null;
    }
  }

  private performAction(
    command: Command,
    instructionID: string,
    args: string[],
  ): void {
    try {
      const result = command(args);
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
    const parts = instructionID.trim().split(/\s+/);
    const id = (parts[0] ?? "").toLowerCase();
    const args = parts.slice(1);
    if (!id) {
      this.consoleStore.addCommandResult({
        type: "error",
        messageKey: "console.error.emptyInput",
      });
      return;
    }
    const command = this.validateInstruction(id);
    if (command) {
      this.performAction(command, id, args);
    }
  }
}
