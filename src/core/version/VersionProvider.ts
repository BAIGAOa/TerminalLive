import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Scope, Scoped } from "di-wise";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
// dist/core/archive → 向上三级到项目根目录
const ROOT = join(_dirname, "..", "..", "..");

@Scoped(Scope.Container)
export class VersionProvider {
  public readonly version: string;

  constructor() {
    try {
      const pkg = JSON.parse(
        readFileSync(join(ROOT, "package.json"), "utf-8"),
      );
      this.version = pkg.version ?? "0.0.0";
    } catch {
      this.version = "0.0.0";
    }
  }
}