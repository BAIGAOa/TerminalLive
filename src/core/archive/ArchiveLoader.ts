import { existsSync, readdirSync, readFileSync, mkdirSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { container } from "../../Container.js";
import { SaveData, saveDataSchema } from "./SaveSchema.js";
import { applySaveData } from "./SaveCodec.js";
import { migrateSave, RawSave } from "./migrations.js";
import ModMonitor from "../mod/ModMonitor.js";
import AutoSave from "./AutoSave.js";

export class ArchiveLoader {
  private readonly ARCHIVE_ROOT = join(homedir(), ".archive_live");

  public load(name: string): void {
    const archiveDir = join(this.ARCHIVE_ROOT, name);
    const data = this.readArchiveData(archiveDir);

    this.loadMod(archiveDir, container.resolve(ModMonitor).MOD_ROOT);
    applySaveData(data);

    // Make this the life the next launch resumes, so the reload lands on it.
    container.resolve(AutoSave).writeData(data);

    console.log("存档已加载，游戏即将重启…… Archive loaded, restarting...");
    setTimeout(() => process.exit(0), 1500);
  }

  private loadMod(archiveDir: string, modRootPath: string): void {
    const modSrcDir = join(archiveDir, "mods");
    if (!existsSync(modSrcDir)) return;

    mkdirSync(modRootPath, { recursive: true });

    let entries;
    try {
      entries = readdirSync(modSrcDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const src = join(modSrcDir, entry.name);
      const dest = join(modRootPath, entry.name);

      if (existsSync(dest)) {
        console.warn(
          `[Mod] 模组 "${entry.name}" 已存在，将被存档中的版本覆盖。 Mod "${entry.name}" already exists and will be overwritten by the archived version.`,
        );
      }
      cpSync(src, dest, { recursive: true, force: true });
    }
  }

  private readArchiveData(archiveDir: string): SaveData {
    const raw = readFileSync(join(archiveDir, "archive.json"), "utf-8");
    try {
      const parsed = JSON.parse(raw) as RawSave;
      return saveDataSchema.parse(migrateSave(parsed));
    } catch {
      throw new Error(
        "存档不兼容，无法加载。 Archive is incompatible and cannot be loaded.",
      );
    }
  }
}
