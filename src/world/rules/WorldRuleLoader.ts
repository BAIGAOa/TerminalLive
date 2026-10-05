import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inject } from "../../Container.js";
import { resourcePath } from "../../core/paths.js";
import WorldRuleRegistry from "./WorldRuleRegistry.js";
import { worldRuleSchema } from "./WorldRule.js";

/** Loads world-rule JSON from a `rules/` dir into the {@link WorldRuleRegistry}. */
export default class WorldRuleLoader {
  private registry: WorldRuleRegistry;

  constructor() {
    this.registry = inject(WorldRuleRegistry);
  }

  public loadDir(dir: string): void {
    if (!existsSync(dir)) return;
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
      return;
    }
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(join(dir, file), "utf-8"));
        for (const entry of Array.isArray(raw) ? raw : [raw]) {
          const data = worldRuleSchema.parse(entry);
          if (!this.registry.has(data.id)) this.registry.register(data.id, data);
        }
      } catch (err) {
        console.warn(`[world-rule] 加载 ${file} 失败:`, (err as Error).message);
      }
    }
  }

  public loadBuiltin(): void {
    this.loadDir(resourcePath("rules"));
  }

  public loadModDir(modRoot: string): void {
    this.loadDir(join(modRoot, "rules"));
  }
}
