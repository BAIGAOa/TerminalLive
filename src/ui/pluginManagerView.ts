import type { PluginRef } from "../core/plugin/manifest.js";
import { pluginDisplayName } from "../core/plugin/manifest.js";
import type { PluginEnablement } from "../core/plugin/sources.js";
import { isPluginEnabled } from "../core/plugin/sources.js";
import { resolveExecutionMode } from "../core/plugin/trust.js";

/**
 * The plugin manager's view-model — pure, so what the screen shows is testable
 * without rendering it.
 */

export interface PluginRow {
  /** Enablement key: a mod's folder name, a shipped plugin's id. */
  key: string;
  id: string;
  /** Display name, already translated. */
  name: string;
  /** One-line description, already translated (empty when none declared). */
  desc: string;
  source: PluginRef["source"];
  enabled: boolean;
  /** Whether it will run with full host access rather than sandboxed. */
  trusted: boolean;
  /** Declared capabilities, for the detail line. */
  capabilities: string[];
  /** The manifest asked for full access (shown even while sandboxed). */
  requestedTrust: boolean;
}

export interface PluginManagerView {
  /** The game's own features: on unless switched off. */
  core: PluginRow[];
  /** Content packs shipped beside the game. */
  builtins: PluginRow[];
  /** Player-installed mods: off until switched on. */
  mods: PluginRow[];
  /** Every plugin, in the order they are listed. */
  all: PluginRow[];
}

function row(
  ref: PluginRef,
  enablement: PluginEnablement,
  trustedIds: readonly string[],
  t: (key: string) => string,
): PluginRow {
  const policy = { trusted: trustedIds };
  return {
    key: ref.source === "mod" ? ref.dirName : ref.id,
    id: ref.id,
    name: ref.manifest.nameKey
      ? t(ref.manifest.nameKey)
      : pluginDisplayName(ref.manifest),
    desc: ref.manifest.descKey ? t(ref.manifest.descKey) : "",
    source: ref.source,
    enabled: isPluginEnabled(ref, enablement),
    trusted: resolveExecutionMode(ref.manifest, policy) === "host",
    capabilities: ref.manifest.capabilities ?? [],
    requestedTrust: ref.manifest.trust === "full",
  };
}

/** Build the rows the manager lists, grouped the way the screen shows them. */
export function buildPluginView(
  refs: readonly PluginRef[],
  enablement: PluginEnablement,
  trustedIds: readonly string[],
  t: (key: string) => string,
): PluginManagerView {
  const groups: Record<PluginRef["source"], PluginRow[]> = {
    core: [],
    builtin: [],
    mod: [],
  };
  for (const ref of refs) {
    groups[ref.source].push(row(ref, enablement, trustedIds, t));
  }
  return {
    core: groups.core,
    builtins: groups.builtin,
    mods: groups.mod,
    all: [...groups.core, ...groups.builtin, ...groups.mod],
  };
}

/**
 * Enable or disable one plugin, returning the new enable list for its source.
 *
 * Shipped plugins are keyed by id and user mods by folder name, so a toggle
 * only ever touches the list that owns the row — and toggling a shipped plugin
 * while the list is still `null` ("all on") materialises it first, so turning
 * one off does not turn every other one off with it.
 */
export function togglePluginEnabled(
  ref: PluginRef,
  enablement: PluginEnablement,
  /**
   * Shipped plugin ids that are enabled **right now**. Needed to expand a
   * `null` list: `null` means "every shipped plugin the game ships is on", not
   * "every id on disk" — an opt-in plugin is off under a `null` list, and
   * materialising it as on would make its first toggle read as "turn it off".
   */
  enabledBuiltinIds: readonly string[],
): PluginEnablement {
  if (ref.source === "core") {
    // The game's own features are opt-out: the disable list is the only record.
    const current = enablement.disabled ?? [];
    const next = current.includes(ref.id)
      ? current.filter((id) => id !== ref.id)
      : [...current, ref.id];
    return { ...enablement, disabled: next };
  }
  if (ref.source === "builtin") {
    // `null` means "all shipped plugins on", so switching one off has to write
    // out the whole list minus that id — otherwise it would read as "only this
    // one", silently disabling every other shipped plugin.
    const current = enablement.builtins ?? [...enabledBuiltinIds];
    const next = current.includes(ref.id)
      ? current.filter((id) => id !== ref.id)
      : [...current, ref.id];
    return { ...enablement, builtins: next };
  }
  const next = enablement.mods.includes(ref.dirName)
    ? enablement.mods.filter((name) => name !== ref.dirName)
    : [...enablement.mods, ref.dirName];
  return { ...enablement, mods: next };
}

/** Add or remove a plugin from the trusted list. */
export function toggleTrusted(
  trustedIds: readonly string[],
  id: string,
): string[] {
  return trustedIds.includes(id)
    ? trustedIds.filter((x) => x !== id)
    : [...trustedIds, id];
}
