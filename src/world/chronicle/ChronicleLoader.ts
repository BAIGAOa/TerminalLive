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

    for (const e of read("eras.json") ?? []) this.registry.registerEra(e as never);
    for (const f of read("factions.json") ?? []) this.registry.registerFaction(f as never);
    for (const r of read("regions.json") ?? []) this.registry.registerRegion(r as never);
    for (const l of read("lore.json") ?? []) this.registry.registerLore(l as never);
    for (const f of read("fates.json") ?? []) this.registry.registerFate(f as never);
    for (const w of read("worldEvents.json") ?? []) this.registry.registerWorldEvent(w as never);
  }
}
