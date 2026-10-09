import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginManifest } from "./manifest.js";
import type { Plugin } from "./types.js";

/**
 * A plugin compiled into the game itself (`src/plugins/<id>/index.ts`).
 *
 * First-party features are plugins like any other — same contract, same
 * capabilities, same lifecycle — but they ship as TypeScript instead of a JS
 * file on disk, so they get types and cannot fail to parse. This is how new
 * game features are meant to be written: as plugins, not as kernel code.
 */
export interface FirstPartyPlugin {
  manifest: PluginManifest;
  plugin: Plugin;
}

/**
 * Where first-party plugins are collected at boot.
 *
 * The composition root (`src/plugins/index.ts`, called from `GameInitialization`)
 * fills this in. The kernel does not import the game's plugin tree — the
 * dependency runs one way.
 */
export default class FirstPartyPlugins {
  private entries: FirstPartyPlugin[] = [];

  /**
   * Where the plugins' own asset folders live, so a first-party plugin can
   * still ship data (languages, events) next to its code.
   */
  public readonly rootDir: string;

  constructor(rootDir?: string) {
    // First-party plugins are compiled next to the core, so their asset folder
    // resolves the same way from `src/` and from `dist/`.
    this.rootDir =
      rootDir ??
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "plugins");
  }

  public register(entry: FirstPartyPlugin): void {
    if (this.entries.some((e) => e.plugin.id === entry.plugin.id)) return;
    this.entries.push(entry);
  }

  public all(): FirstPartyPlugin[] {
    return this.entries;
  }

  public get(id: string): FirstPartyPlugin | undefined {
    return this.entries.find((e) => e.plugin.id === id);
  }
}
