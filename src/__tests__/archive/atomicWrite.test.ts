import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  atomicWriteJsonSync,
  quarantineFileSync,
} from "../../core/archive/atomicWrite.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "tl-atomic-"));
  dirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("atomicWriteJsonSync", () => {
  it("writes JSON and leaves no temp file behind", () => {
    const file = join(tmp(), "save.json");
    atomicWriteJsonSync(file, { a: 1 });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ a: 1 });
    expect(existsSync(`${file}.tmp-${process.pid}`)).toBe(false);
  });

  it("replaces an existing file in place", () => {
    const file = join(tmp(), "save.json");
    writeFileSync(file, '{"old":true}');
    atomicWriteJsonSync(file, { fresh: true });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ fresh: true });
  });
});

describe("quarantineFileSync", () => {
  it("renames the file aside instead of deleting it", () => {
    const file = join(tmp(), "life.json");
    writeFileSync(file, "not json {");
    const kept = quarantineFileSync(file);
    expect(kept).not.toBeNull();
    expect(existsSync(file)).toBe(false);
    expect(readFileSync(kept!, "utf8")).toBe("not json {");
  });

  it("returns null when the file does not exist", () => {
    expect(quarantineFileSync(join(tmp(), "nope.json"))).toBeNull();
  });
});
