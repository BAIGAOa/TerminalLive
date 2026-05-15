import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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
    await writeFile(this.SAVE_PATH, JSON.stringify(data, null, 2), "utf-8");
  }

  async load(): Promise<UnlockedRecord[]> {
    try {
      const content = await readFile(this.SAVE_PATH, "utf-8");
      return JSON.parse(content) as UnlockedRecord[];
    } catch {
      return [];
    }
  }
}