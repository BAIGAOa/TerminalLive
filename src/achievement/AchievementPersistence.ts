import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { atomicWriteJsonSync } from "../core/archive/atomicWrite.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

export interface UnlockedRecord {
  id: string;
  unlockedAt: number | null;
}

export default class AchievementPersistence {
  private readonly SAVE_PATH = join(
    _dirname, "..", "..", "resource", "achievement", "unlocked.json",
  );

  async save(data: UnlockedRecord[]): Promise<void> {
    atomicWriteJsonSync(this.SAVE_PATH, data);
  }

  async load(): Promise<UnlockedRecord[]> {
    try {
      const content = await readFile(this.SAVE_PATH, "utf-8");
      const parsed: unknown = JSON.parse(content);
      // A parse success is not a shape success: `{}` would otherwise reach
      // `for (const ... of records)` in AchievementManager and crash boot.
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (r): r is UnlockedRecord =>
          !!r && typeof r === "object" && typeof (r as UnlockedRecord).id === "string",
      );
    } catch {
      return [];
    }
  }
}