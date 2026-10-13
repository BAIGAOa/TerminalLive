import { inject } from "../../Container.js";
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { saveDataSchema } from "./SaveSchema.js";
import { captureSaveData } from "./SaveCodec.js";
import { atomicWriteJsonSync } from "./atomicWrite.js";
import { isValidSaveName, resolveWithin } from "./saveName.js";
import type ConfigStore from "../store/ConfigStore.js";
import ModMonitor from "../mod/ModMonitor.js";
import MailStore, { MAIL_FILENAME } from "../../world/mail/MailStore.js";

export class ArchivingKeeper {
  private readonly ARCHIVE_ROOT = join(homedir(), ".archive_live");
  private modRegistry: ModMonitor;

  constructor() {
    this.modRegistry = inject(ModMonitor);
  }

  public save(name: string, configStore: ConfigStore): void {
    if (!isValidSaveName(name)) {
      throw new Error(`不合法的存档名: ${JSON.stringify(name)}`);
    }
    const archiveDir = this.ensureDir(name);
    const modNames = configStore.getEnabledMods();
    this.saveMod(archiveDir, modNames);

    const data = captureSaveData();
    saveDataSchema.parse(data);
    atomicWriteJsonSync(join(archiveDir, "archive.json"), data);
    this.saveMail(archiveDir);
  }

  /**
   * Copy the mailbox in beside the save.
   *
   * The letters have their own file now, so an archive holding only the JSON
   * blob would restore a life without its correspondence. Copying keeps the
   * archive self-contained, the way mods already are.
   */
  private saveMail(archiveDir: string): void {
    const store = inject(MailStore);
    const dest = join(archiveDir, MAIL_FILENAME);
    try {
      if (store.exists()) {
        cpSync(store.path, dest);
        return;
      }
      // Overwriting an archive with a life that has no letters must not leave
      // the previous save's mailbox sitting there for the next load to find.
      if (existsSync(dest)) rmSync(dest, { force: true });
    } catch (err) {
      console.warn("[Archive] 信箱未能写入存档:", (err as Error).message);
    }
  }

  private saveMod(archiveDir: string, modNames: string[]): void {
    if (modNames.length === 0) return;
    const modDest = join(archiveDir, "mods");
    mkdirSync(modDest, { recursive: true });
    for (const modName of modNames) {
      const src = join(this.modRegistry.MOD_ROOT, modName);
      if (existsSync(src)) {
        cpSync(src, join(modDest, modName), { recursive: true, force: true });
      }
    }
  }

  private ensureDir(name: string): string {
    const dir = resolveWithin(this.ARCHIVE_ROOT, name);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
}
