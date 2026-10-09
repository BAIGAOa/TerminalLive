import BaseRegistry from "./BaseRegistry.js";

/** A rebindable shortcut: what it does, and the key it starts on. */
export interface KeyAction {
  id: string;
  /** i18n key for the action's label. */
  labelKey: string;
  defaultKey: string;
}

/**
 * The shortcuts a player may rebind.
 *
 * A registry rather than a constant, because the list is an extension point:
 * the keybindings plugin registers the game's own shortcuts, and any other
 * plugin with a screen of its own contributes a hotkey for it through the
 * `ui.keyactions` service. The action list in the settings screen is therefore
 * whatever is installed, not a hard-coded four.
 */
export default class KeyActionRegistry extends BaseRegistry<KeyAction> {
  /**
   * The shortcuts the game cannot do without.
   *
   * Used when *nothing* registered — a player who disabled the keybindings
   * plugin would otherwise lose the console hotkey and have no way back in.
   */
  public static readonly DEFAULTS: readonly KeyAction[] = [
    // In-game
    { id: "console", labelKey: "key.action.console", defaultKey: "p" },
    { id: "help", labelKey: "key.action.help", defaultKey: "?" },
    { id: "menu", labelKey: "key.action.menu", defaultKey: "q" },
    { id: "endTurn", labelKey: "key.action.endTurn", defaultKey: "e" },
    { id: "viewPrev", labelKey: "key.action.viewPrev", defaultKey: "left" },
    { id: "viewNext", labelKey: "key.action.viewNext", defaultKey: "right" },
    { id: "logScrollUp", labelKey: "key.action.logScrollUp", defaultKey: "pageup" },
    { id: "logScrollDown", labelKey: "key.action.logScrollDown", defaultKey: "pagedown" },
    { id: "logTop", labelKey: "key.action.logTop", defaultKey: "home" },
    { id: "logBottom", labelKey: "key.action.logBottom", defaultKey: "end" },
    // Archives
    { id: "saveArchive", labelKey: "key.action.saveArchive", defaultKey: "s" },
    { id: "deleteArchive", labelKey: "key.action.deleteArchive", defaultKey: "d" },
    // Plugins
    { id: "reloadPlugins", labelKey: "key.action.reloadPlugins", defaultKey: "r" },
    { id: "toggleTrust", labelKey: "key.action.toggleTrust", defaultKey: "t" },
  ];

  /** What the settings screen lists: the installed actions, or the built-ins. */
  public effective(): KeyAction[] {
    return this.getCount() > 0 ? this.getAll() : [...KeyActionRegistry.DEFAULTS];
  }
}
