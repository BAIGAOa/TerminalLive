import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inject } from "../../Container.js";
import ChronicleRegistry from "./ChronicleRegistry.js";

/**
 * Loads a world's chronicle content from a `chronicle/` directory
 * (`eras.json`, `factions.json`, `regions.json`, `lore.json`, `fates.json`,
 * `worldEvents.json`) into the {@link ChronicleRegistry}. Missing files are
 * skipped, so a world may override only the parts it cares about. The caller
 * clears the registry first when a world is self-contained.
 */
export default class ChronicleLoader {
  private registry: ChronicleRegistry;

  constructor() {
    this.registry = inject(ChronicleRegistry);
  }

  public loadDir(dir: string): void {
    const read = (name: string): unknown[] | null => {
      const path = join(dir, name);
      if (!existsSync(path)) return null;
      try {
        const raw = JSON.parse(readFileSync(path, "utf-8"));
        return Array.isArray(raw) ? raw : [raw];
      } catch (err) {
        console.error(`[chronicle] 解析 ${path} 失败:`, (err as Error).message);
        return null;
      }
    };

    // Register per entry: a duplicate id (e.g. a mod layering an existing
    // definition) or a malformed entry must be skipped with a warning, not
    // thrown out of `start()` and abort the whole boot.
    const apply = (name: string, register: (entry: unknown) => void): void => {
      for (const entry of read(name) ?? []) {
        try {
          register(entry);
        } catch (err) {
          console.warn(
            `[chronicle] 跳过 ${name} 中重复或无效的条目:`,
            (err as Error).message,
          );
        }
      }
    };
    apply("eras.json", (e) => this.registry.registerEra(e as never));
    apply("factions.json", (f) => this.registry.registerFaction(f as never));
    apply("regions.json", (r) => this.registry.registerRegion(r as never));
    apply("lore.json", (l) => this.registry.registerLore(l as never));
    apply("fates.json", (f) => this.registry.registerFate(f as never));
    apply("worldEvents.json", (w) => this.registry.registerWorldEvent(w as never));
  }
}
