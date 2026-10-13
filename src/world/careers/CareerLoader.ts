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
      let entries: unknown[];
      try {
        const raw = JSON.parse(readFileSync(join(dir, name), "utf-8"));
        entries = Array.isArray(raw) ? raw : [raw];
      } catch (err) {
        console.warn(`[careers] ${name} 不是合法 JSON:`, (err as Error).message);
        continue;
      }
      // Validated one entry at a time on purpose: a single bad career used to
      // throw out of the loop and take the rest of the file with it, so one
      // typo in one job silently emptied the whole board. The message names the
      // job that failed, because a console warning on stderr is all a TUI run
      // ever shows of this.
      for (const entry of entries) {
        const id = (entry as { id?: string } | null)?.id;
        try {
          const data = careerSchema.parse(entry) as CareerDefinition;
          if (!this.registry.has(data.id)) this.registry.register(data);
        } catch (err) {
          console.warn(
            `[careers] 跳过 "${id ?? "?"}"（${name}）: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  public loadBuiltin(): void {
    this.loadDir(resourcePath("careers"));
  }
}
