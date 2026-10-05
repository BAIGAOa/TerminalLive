import { inject } from "../../Container.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import NpcRegistry from "./NpcRegistry.js";
import { npcSchema } from "./NpcDefinition.js";
import { resourcePath } from "../../core/paths.js";

export default class NpcLoader {
  private registry: NpcRegistry;
  /** Mod `npcs/` dirs, re-applied after a world replaces the cast. */
  private modDirs: string[] = [];

  constructor() {
    this.registry = inject(NpcRegistry);
  }

  public loadDir(dir: string): void {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(readFileSync(join(dir, name), "utf-8"));
        const entries = Array.isArray(raw) ? raw : [raw];
        for (const entry of entries) {
          const data = npcSchema.parse(entry);
          if (this.registry.has(data.id)) continue;
          this.registry.register(data);
        }
      } catch (err) {
        console.warn(`[npcs] 加载 ${name} 失败:`, (err as Error).message);
      }
    }
  }

  public loadBuiltin(): void {
    // The classic world holds the built-in cast; other worlds layer their own.
    this.loadDir(join(resourcePath("worlds"), "classic", "npcs"));
  }

  /** A mod's `npcs/` dir; remembered so a world replace can re-apply it. */
  public loadModDir(dir: string): void {
    if (!this.modDirs.includes(dir)) this.modDirs.push(dir);
    this.loadDir(dir);
  }

  /** Re-apply every registered mod npc dir (after a world swapped the cast). */
  public reloadModDirs(): void {
    for (const dir of this.modDirs) this.loadDir(dir);
  }
}
