import type { PluginRef } from "./manifest.js";
import { resolveLoadOrder, type LoadOrderResult } from "./loadOrder.js";

/**
 * Which plugins the user has switched on.
 *
 * The two lists are keyed differently, and deliberately so: a user mod is
 * toggled by its folder name (the id inside `mod.json` is optional and must not
 * be able to hide which folder is running), while a shipped plugin is toggled
 * by its manifest id.
 */
export interface PluginEnablement {
  /** Folder names of the user mods that are on. */
  mods: readonly string[];
  /** Ids of the shipped plugins that are on; `null` means every one of them. */
  builtins: readonly string[] | null;
  /** Ids of the game's own plugins the player switched **off**. */
  disabled?: readonly string[];
}

/**
 * Whether a discovered plugin should be loaded, per the enablement lists.
 *
 * The three sources answer to different defaults on purpose (see `PluginSource`):
 * the game's own features are opt-out so a new one always works, shipped content
 * packs follow the whitelist, and mods are opt-in.
 */
export function isPluginEnabled(
  ref: PluginRef,
  enablement: PluginEnablement,
): boolean {
  switch (ref.source) {
    case "mod":
      return enablement.mods.includes(ref.dirName);
    case "core":
      return !(enablement.disabled ?? []).includes(ref.id);
    default:
      // Opt-in shipped plugins: a `null` list means "all the defaults", not
      // "everything on disk" — a plugin that replaces a screen must be asked
      // for by id.
      if (ref.manifest.defaultEnabled === false) {
        return (enablement.builtins ?? []).includes(ref.id);
      }
      return (
        enablement.builtins === null || enablement.builtins.includes(ref.id)
      );
  }
}

/** The enabled subset, in discovery order. */
export function selectEnabledPlugins(
  refs: readonly PluginRef[],
  enablement: PluginEnablement,
): PluginRef[] {
  return refs.filter((ref) => isPluginEnabled(ref, enablement));
}

/**
 * The full load plan: enabled plugins, dependency-ordered, with the ones that
 * could not be loaded and why. Every plugin — shipped or user — goes through
 * this same path, so a built-in can depend on a mod and vice versa.
 */
export function planPluginLoad(
  refs: readonly PluginRef[],
  enablement: PluginEnablement,
): LoadOrderResult<PluginRef> {
  return resolveLoadOrder(selectEnabledPlugins(refs, enablement));
}

/** Group discovered plugins by source, for the settings screen. */
export function groupBySource(refs: readonly PluginRef[]): {
  builtins: PluginRef[];
  mods: PluginRef[];
} {
  const builtins: PluginRef[] = [];
  const mods: PluginRef[] = [];
  for (const ref of refs) (ref.source === "builtin" ? builtins : mods).push(ref);
  return { builtins, mods };
}
