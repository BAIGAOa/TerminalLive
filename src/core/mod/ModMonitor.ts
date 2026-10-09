import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { ModManifest, modManifestSchema } from "./types.js";
import { PLUGIN_CONTENT_DIRS } from "../plugin/discovery.js";

/**
 * Discovers mods under `~/.mod_live/` and answers path/structure questions.
 * It does not execute mod code — that is the loader's job.
 */
export default class ModMonitor {
  public readonly MOD_ROOT: string;

  /**
   * Resource sub-directories a mod may ship.
   *
   * Shared with the kernel — two copies of this list is how discovery and
   * validity quietly start disagreeing about what a mod is allowed to contain.
   */
  private static readonly RESOURCE_DIRS = PLUGIN_CONTENT_DIRS;

  constructor() {
    this.MOD_ROOT = join(homedir(), ".mod_live");
    this.ensureRoot();
  }

  private ensureRoot(): void {
    if (!existsSync(this.MOD_ROOT)) {
      mkdirSync(this.MOD_ROOT, { recursive: true });
    }
  }

  /** Top-level mod folders (hidden folders ignored). */
  public getAllMods(): string[] {
    try {
      return readdirSync(this.MOD_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }

  public getModPath(modName: string): string {
    return join(this.MOD_ROOT, modName);
  }
  public getModEventsPath(modName: string): string {
    return join(this.MOD_ROOT, modName, "events");
  }
  public getModAchievementsPath(modName: string): string {
    return join(this.MOD_ROOT, modName, "achievements");
  }
  public getModMainPath(modName: string): string {
    return join(this.MOD_ROOT, modName, "index.js");
  }

  /** A mod is valid if it ships a manifest, a plugin entry, or any resource dir. */
  public isValid(modName: string): boolean {
    const p = this.getModPath(modName);
    if (!existsSync(p)) return false;
    if (this.getModManifest(modName)) return true;
    if (existsSync(this.getModMainPath(modName))) return true;
    return ModMonitor.RESOURCE_DIRS.some((d) =>
      existsSync(join(p, d)),
    );
  }

  /** Parse and validate a mod's manifest; `id` defaults to the folder name. */
  public getModManifest(modName: string): ModManifest | null {
    const file = join(this.MOD_ROOT, modName, "mod.json");
    if (!existsSync(file)) return null;
    try {
      const raw = JSON.parse(readFileSync(file, "utf-8"));
      const parsed = modManifestSchema.parse(raw);
      return { ...parsed, id: parsed.id ?? modName };
    } catch {
      return null;
    }
  }

}
