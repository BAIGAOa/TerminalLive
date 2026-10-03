import { inject } from "../../Container.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ItemRegistry from "./ItemRegistry.js";
import { itemSchema } from "./ItemDefinition.js";
import { resourcePath } from "../../core/paths.js";

export default class ItemLoader {
  private registry: ItemRegistry;

  constructor() {
    this.registry = inject(ItemRegistry);
  }

  public loadDir(dir: string): void {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(readFileSync(join(dir, name), "utf-8"));
        const entries = Array.isArray(raw) ? raw : [raw];
        for (const entry of entries) {
          const data = itemSchema.parse(entry);
          if (this.registry.has(data.id)) continue;
          this.registry.register(data);
        }
      } catch (err) {
        console.warn(`[items] 加载 ${name} 失败:`, (err as Error).message);
      }
    }
  }

  public loadBuiltin(): void {
    this.loadDir(resourcePath("items"));
  }
}
