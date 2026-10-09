import ReplRegistry from "../ReplRegistry.js";
import { registerNavCommands } from "./nav.js";
import { registerGameCommands } from "./game.js";
import { registerSystemCommands } from "./system.js";

/**
 * Registries the built-ins have already been installed into.
 *
 * Keyed by registry rather than a module-global flag: sniffing the table for
 * "is it non-empty" would make the console lose every built-in the moment a
 * plugin registered its own command first, and a module-global flag would stop
 * a second boot (a reset container, a test) from ever populating its table.
 */
const installed = new WeakSet<ReplRegistry>();

/** Register every built-in terminal command. Safe to call once per registry. */
export function registerReplCommands(reg: ReplRegistry): void {
  if (installed.has(reg)) return;
  installed.add(reg);
  registerGameCommands(reg);
  registerNavCommands(reg);
  registerSystemCommands(reg);
}
