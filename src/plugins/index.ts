import FirstPartyPlugins from "../core/plugin/FirstParty.js";
import * as statusViews from "./status-views/index.js";
import * as consoleCommands from "./console-commands/index.js";
import * as keybindings from "./keybindings/index.js";

/**
 * The game's own plugins.
 *
 * Everything the game does beyond the kernel lives here, mounted through the
 * same host as a user mod: this array is the whole difference between "shipped
 * with the game" and "installed by the player". Adding a feature means adding
 * an entry here — and every one of them can be replaced by a mod that provides
 * the same ids.
 *
 * Called from the composition root (`GameInitialization`) before any plugin
 * loads, so the list is populated by the time the host plans its load order.
 */
export function registerFirstPartyPlugins(registry: FirstPartyPlugins): void {
  registry.register({ manifest: statusViews.manifest, plugin: statusViews.plugin });
  registry.register({
    manifest: consoleCommands.manifest,
    plugin: consoleCommands.plugin,
  });
  registry.register({ manifest: keybindings.manifest, plugin: keybindings.plugin });
}
