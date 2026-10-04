import { inject } from "../../Container.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import CareerRegistry from "./CareerRegistry.js";
import { careerSchema, CareerDefinition } from "./CareerDefinition.js";
import { resourcePath } from "../../core/paths.js";

export default class CareerLoader {
  private registry: CareerRegistry;

  constructor() {
    this.registry = inject(CareerRegistry);
  }

  public loadDir(dir: string): void {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(readFileSync(join(dir, name), "utf-8"));
        const entries = Array.isArray(raw) ? raw : [raw];
        for (const entry of entries) {
          const data = careerSchema.parse(entry) as CareerDefinition;
          if (this.registry.has(data.id)) continue;
          this.registry.register(data);
        }
      } catch (err) {
        console.warn(`[careers] 加载 ${name} 失败:`, (err as Error).message);
      }
    }
  }

  public loadBuiltin(): void {
    this.loadDir(resourcePath("careers"));
  }
}
