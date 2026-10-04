import ReplRegistry from "../ReplRegistry.js";
import { registerNavCommands } from "./nav.js";
import { registerGameCommands } from "./game.js";
import { registerSystemCommands } from "./system.js";

/** Register every built-in terminal command. Safe to call once. */
export function registerReplCommands(reg: ReplRegistry): void {
  if (reg.all().length > 0) return;
  registerGameCommands(reg);
  registerNavCommands(reg);
  registerSystemCommands(reg);
}
