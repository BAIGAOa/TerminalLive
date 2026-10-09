import z from "zod";

/**
 * The plugin manifest — one schema for every plugin, wherever it lives.
 *
 * A plugin is identified by the same file in both sources: `mod.json` in a user
 * mod folder under `~/.mod_live/`, `plugin.json` in a shipped plugin under
 * `resource/plugins/`. Built-ins and user mods differ only in where they are
 * discovered and whether they are on by default — never in what they may do.
 *
 * Built-in plugins additionally carry game content (NPC behaviours, hidden-score
 * axes, world rules). That payload is read by the content subsystem from the
 * same JSON; the kernel deliberately does not model it.
 */

/** The plugin API version this build of the game speaks. */
export const PLUGIN_API_VERSION = 1;

/**
 * How a plugin's entry file is evaluated.
 *
 * - `sandbox` — inside a `node:vm` context with a whitelisted `require`. Cheap
 *   reassurance, but the plugin can still reach the host realm and it loses
 *   cross-realm `instanceof`/classes.
 * - `full` — plain host evaluation, with a real `require`. Needed by plugins
 *   that extend the game deeply (subclassing, private fields, native modules).
 */
export const PLUGIN_TRUST = ["sandbox", "full"] as const;
export type PluginTrust = (typeof PLUGIN_TRUST)[number];

export const pluginManifestSchema = z.object({
  /** Stable id. Defaults to the folder name when omitted. */
  id: z.string().optional(),
  /** Display name (user mods). */
  name: z.string().optional(),
  /** i18n key for the display name (shipped plugins, so they localise). */
  nameKey: z.string().optional(),
  /** i18n key for the description. */
  descKey: z.string().optional(),
  version: z.string().default("0.0.0"),
  apiVersion: z.number().default(PLUGIN_API_VERSION),
  description: z.string().optional(),
  author: z.string().optional(),
  /** Entry file, relative to the plugin folder. */
  main: z.string().default("index.js"),
  /** id → semver range. Mismatches warn; a missing dependency skips the plugin. */
  dependencies: z.record(z.string(), z.string()).default({}),
  /**
   * Declared powers (events/items/npcs/levels/world/random/ui/storage). Omitted
   * = legacy content capabilities only (events/items/npcs/levels).
   */
  capabilities: z.array(z.string()).optional(),
  /** Evaluation mode for the entry file. Defaults to the sandbox. */
  trust: z.enum(PLUGIN_TRUST).default("sandbox"),
  /** Restrict a shipped plugin to one world id; omit to apply everywhere. */
  world: z.string().optional(),
  /**
   * Whether a shipped plugin starts switched on. Defaults to true.
   *
   * Set it to false for a plugin that changes something the player already
   * relies on — a replacement screen, a reworked panel. "All shipped plugins
   * on" must not silently mean "your game looks different now"; an opt-in
   * plugin is only on when the player lists it.
   */
  defaultEnabled: z.boolean().default(true),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

/**
 * Where a plugin came from — which is also how it decides whether it is on.
 *
 * - `core` — a feature compiled into the game (`src/plugins/`). On unless the
 *   player switches it off: a new game feature must work out of the box, and a
 *   whitelist written before it existed would silently disable it.
 * - `builtin` — a content pack shipped beside the game (`resource/plugins/`).
 *   On while the config's `enabledBuiltinPlugins` is absent ("all of them"),
 *   otherwise only when listed.
 * - `mod` — installed by the player. Off until switched on.
 */
export type PluginSource = "core" | "builtin" | "mod";

/** A plugin found on disk, resolved but not yet evaluated. */
export interface PluginRef {
  /** Manifest id, falling back to the folder name. */
  id: string;
  /** Folder name inside its root — the key user mods are enabled by. */
  dirName: string;
  /** Absolute path to the plugin folder. */
  dir: string;
  source: PluginSource;
  manifest: PluginManifest;
}

/**
 * Build a manifest for a plugin compiled into the game, filling in defaults.
 * First-party plugins declare their manifest in code (no JSON to keep in sync),
 * so they get the same parsed shape as one read from disk.
 */
export function definePluginManifest(
  input: z.input<typeof pluginManifestSchema>,
): PluginManifest {
  return pluginManifestSchema.parse(input);
}

/** The display name to show for a plugin, preferring a localisable key. */
export function pluginDisplayName(manifest: PluginManifest): string {
  return manifest.nameKey ?? manifest.name ?? manifest.id ?? "";
}
