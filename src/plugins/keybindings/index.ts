import { definePluginManifest } from "../../core/plugin/manifest.js";
import type { Plugin } from "../../core/plugin/types.js";
import KeyActionRegistry, {
  type KeyAction,
} from "../../core/registry/KeyActionRegistry.js";
import KeyBindingScreen from "../../ui/KeyBinding.js";

export const id = "core.keybindings";

export const manifest = definePluginManifest({
  id,
  nameKey: "plugin.core.keybindings.name",
  descKey: "plugin.core.keybindings.desc",
  capabilities: ["ui", "kernel"],
});

/**
 * The Settings → Key bindings page, as a plugin.
 *
 * Two things make this more than a relocation:
 *
 * 1. It registers its own settings page, so the feature can be switched off —
 *    which is what "everything is a plugin" is supposed to mean.
 * 2. It publishes `ui.keyactions`, so the list of rebindable shortcuts is an
 *    extension point rather than a hard-coded four. Another plugin with its own
 *    screen adds its hotkey and it appears in this editor, conflict checking
 *    and all.
 */

/** What a plugin gets from the `ui.keyactions` service. */
export interface KeyActionService {
  /** Offer a rebindable shortcut. Re-registering an id replaces it. */
  add(action: KeyAction): void;
  /** Every shortcut currently offered. */
  list(): KeyAction[];
}

export const KEY_ACTION_SERVICE = "ui.keyactions";

export const plugin: Plugin = {
  id,
  hooks: {
    onInit(ctx) {
      const registry = ctx.kernel.keyActions;

      // The game's own shortcuts. `set` rather than `register`: a hot reload
      // re-runs onInit against a registry that already holds them.
      for (const action of KeyActionRegistry.DEFAULTS) {
        registry.set(action.id, action);
      }

      // Let other plugins contribute hotkeys of their own.
      ctx.services.provide<KeyActionService>(KEY_ACTION_SERVICE, {
        add: (action) => {
          registry.set(action.id, action);
          ctx.logger.info(`新增可绑定快捷键: ${action.id} (${action.defaultKey})`);
        },
        list: () => registry.getAll(),
      });

      ctx.addSetting("keyboard", {
        component: KeyBindingScreen,
        nameKey: "setting.keyBoardConfig",
      });

      ctx.logger.info("键位设置已就绪");
    },
  },
};
