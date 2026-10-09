/**
 * Deprecated alias for the kernel's plugin contract.
 *
 * The manifest schema and the context/hook types live in `core/plugin/` now,
 * because shipped plugins and user mods share one contract. These names stay so
 * the user-mod side of the codebase keeps compiling during the migration.
 */
export {
  PLUGIN_API_VERSION as MOD_API_VERSION,
  pluginManifestSchema as modManifestSchema,
  type PluginManifest as ModManifest,
  type PluginSource,
  type PluginRef,
} from "../plugin/manifest.js";
export * from "../plugin/types.js";

import { pluginManifestSchema } from "../plugin/manifest.js";

/** A mod resolved from disk: its folder + parsed manifest. */
export interface ResolvedMod {
  dirName: string;
  id: string;
  manifest: import("../plugin/manifest.js").PluginManifest;
}

/** Parse a manifest the way the user-mod side always has (id defaults to dir). */
export function parseModManifest(
  raw: unknown,
  dirName: string,
): import("../plugin/manifest.js").PluginManifest {
  const parsed = pluginManifestSchema.parse(raw);
  return { ...parsed, id: parsed.id ?? dirName };
}
