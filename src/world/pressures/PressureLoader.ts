import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inject } from "../../Container.js";
import PressureRegistry from "./PressureRegistry.js";
import { pressureAxisSchema } from "./PressureDefinition.js";
import { pressureRuleSchema } from "./PressureRule.js";
import { resourcePath } from "../../core/paths.js";

/** Loads pressure axes + coupling rules from `resource/pressures/`. */
export default class PressureLoader {
  private registry: PressureRegistry;

  constructor() {
    this.registry = inject(PressureRegistry);
  }

  public loadDir(dir: string): void {
    if (!existsSync(dir)) return;
    const axesFile = join(dir, "axes.json");
    const rulesFile = join(dir, "rules.json");
    try {
      if (existsSync(axesFile)) {
        const raw = JSON.parse(readFileSync(axesFile, "utf-8"));
        for (const entry of Array.isArray(raw) ? raw : [raw]) {
          const data = pressureAxisSchema.parse(entry);
          if (!this.registry.hasAxis(data.id)) this.registry.registerAxis(data);
        }
      }
      if (existsSync(rulesFile)) {
        const raw = JSON.parse(readFileSync(rulesFile, "utf-8"));
        for (const entry of Array.isArray(raw) ? raw : [raw]) {
          this.registry.registerRule(pressureRuleSchema.parse(entry));
        }
      }
    } catch (err) {
      console.warn(`[pressures] 加载 ${dir} 失败:`, (err as Error).message);
    }
  }

  public loadBuiltin(): void {
    this.loadDir(resourcePath("pressures"));
    this.registry.pruneInvalidRules();
  }

  /** Mods may ship extra axes/rules in their own `pressures/` dir. */
  public loadModDir(modRoot: string): void {
    this.loadDir(join(modRoot, "pressures"));
    this.registry.pruneInvalidRules();
  }
}
