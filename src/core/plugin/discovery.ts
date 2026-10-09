import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resourcePath } from "../paths.js";
import {
  PluginRef,
  PluginSource,
  pluginManifestSchema,
  type PluginManifest,
} from "./manifest.js";

/**
 * Where a kind of plugin lives and what makes a folder one.
 *
 * Shipped plugins and user mods are the same thing in different clothes, so the
 * scan is parameterised rather than duplicated: only the root, the manifest
 * filename and the default-on behaviour differ.
 */
export interface PluginRootSpec {
  source: PluginSource;
  /** Absolute directory holding one folder per plugin. */
  root: string;
  /** Manifest file inside each folder (`plugin.json` / `mod.json`). */
  manifestFile: string;
  /** Entry file inside each folder, when the manifest does not name one. */
  defaultEntry: string;
  /** Sub-directories that make a folder a plugin even without a manifest. */
  contentDirs: readonly string[];
}

/** Content folders a plugin may ship, for either source. */
export const PLUGIN_CONTENT_DIRS = [
  "events",
  "language",
  "items",
  "npcs",
  "levels",
  "achievements",
  "pressures",
] as const;

/** Shipped plugins: `resource/plugins/<id>/plugin.json`. */
export function builtinRoot(): PluginRootSpec {
  return {
    source: "builtin",
    root: resourcePath("plugins"),
    manifestFile: "plugin.json",
    defaultEntry: "index.js",
    contentDirs: PLUGIN_CONTENT_DIRS,
  };
}

/** User mods: `~/.mod_live/<dir>/mod.json`. */
export function modRoot(root: string): PluginRootSpec {
  return {
    source: "mod",
    root,
    manifestFile: "mod.json",
    defaultEntry: "index.js",
    contentDirs: PLUGIN_CONTENT_DIRS,
  };
}

/**
 * Parse a manifest, falling back to the folder name as the id. Returns null for
 * a manifest that does not validate — a broken plugin is skipped, never fatal.
 */
export function parsePluginManifest(
  raw: unknown,
  fallbackId: string,
): PluginManifest | null {
  try {
    const parsed = pluginManifestSchema.parse(raw);
    return { ...parsed, id: parsed.id ?? fallbackId };
  } catch {
    return null;
  }
}

/** Whether a folder holds a plugin: a manifest, an entry file, or content. */
export function looksLikePlugin(
  dir: string,
  spec: Pick<PluginRootSpec, "manifestFile" | "contentDirs">,
  entryFile = "index.js",
): boolean {
  if (!existsSync(dir)) return false;
  if (existsSync(join(dir, spec.manifestFile))) return true;
  if (existsSync(join(dir, entryFile))) return true;
  return spec.contentDirs.some((d) => existsSync(join(dir, d)));
}

/** Scan one root into refs. Invalid plugins are skipped with a warning. */
export function discoverPlugins(spec: PluginRootSpec): PluginRef[] {
  let names: string[];
  try {
    names = readdirSync(spec.root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name);
  } catch {
    return []; // no root folder yet — nothing to load, not an error
  }

  const refs: PluginRef[] = [];
  for (const dirName of names) {
    const dir = join(spec.root, dirName);
    if (!looksLikePlugin(dir, spec, spec.defaultEntry)) continue;

    const manifestPath = join(dir, spec.manifestFile);
    let manifest: PluginManifest;
    if (existsSync(manifestPath)) {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
      } catch (err) {
        console.error(
          `[plugin] ${spec.manifestFile} 解析失败 (${dirName}):`,
          (err as Error).message,
        );
        continue;
      }
      const parsed = parsePluginManifest(raw, dirName);
      if (!parsed) {
        console.error(`[plugin] 清单校验失败 (${dirName})，已跳过`);
        continue;
      }
      manifest = parsed;
    } else {
      // A folder with only content or only an entry file is still a plugin.
      manifest = pluginManifestSchema.parse({ name: dirName, id: dirName });
    }

    refs.push({
      id: manifest.id ?? dirName,
      dirName,
      dir,
      source: spec.source,
      manifest,
    });
  }
  return refs;
}

