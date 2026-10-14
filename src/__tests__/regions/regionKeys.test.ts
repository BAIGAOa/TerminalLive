import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every translation key the region code can emit must exist in every language.
 *
 * `translate.ts` falls back to rendering the key itself, so a missing entry is
 * not a crash — it is the raw string `region.ev.region.collapse` appearing in
 * the player's face. That is exactly what happened with the narrator's era and
 * region beats, and the fix is to make it impossible to ship rather than to
 * notice it in a screenshot.
 *
 * The event kinds are read out of the engine's source rather than listed here,
 * so adding a `kind:` without a translation fails this test instead of quietly
 * relying on someone remembering to update a list.
 */

const ROOT = join(__dirname, "..", "..", "..");
const LANGS = ["zh_CN", "en_US", "ja_JP", "ru_RU"] as const;

function engineEventKeys(): string[] {
  const src = readFileSync(
    join(ROOT, "src", "world", "regions", "regionEngine.ts"),
    "utf8",
  );
  const kinds = [...src.matchAll(/kind:\s*"(region\.[a-z]+)"/g)].map((m) => m[1]);
  // `moveTo` returns the same shape but is built in `RegionsSystem`.
  return [...new Set([...kinds, "region.moved", "region.unreachable"])].map(
    (k) => `region.ev.${k}`,
  );
}

/** Keys emitted as literals rather than interpolated from an event kind. */
const LITERAL_KEYS = [
  "region.log.tier.thriving",
  "region.log.tier.stable",
  "region.log.tier.strained",
  "region.log.tier.declining",
  "region.tier.ruined",
  "region.ev.region.prosper",
  "region.ev.region.hardship",
  "repl.cmd.moveRegion",
  "console.cmd.moveRegion",
  "console.cmd.moveRegionUsage",
  "console.cmd.moveRegionUnknown",
  "console.cmd.moveRegionUnreachable",
];

function translations(lang: string): Record<string, string> {
  return JSON.parse(
    readFileSync(join(ROOT, "resource", "language", `${lang}.json`), "utf8"),
  );
}

describe("region translation coverage", () => {
  const needed = [...engineEventKeys(), ...LITERAL_KEYS];

  it("finds the event kinds it is supposed to be guarding", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(engineEventKeys().length).toBeGreaterThanOrEqual(6);
  });

  for (const lang of LANGS) {
    it(`${lang} defines every key the region code can emit`, () => {
      const t = translations(lang);
      const missing = needed.filter((k) => !(k in t));
      expect(missing).toEqual([]);
    });
  }

  it("gives every region key a non-empty string", () => {
    for (const lang of LANGS) {
      const t = translations(lang);
      for (const key of needed) {
        expect(typeof t[key], `${lang} ${key}`).toBe("string");
        expect(t[key].length, `${lang} ${key}`).toBeGreaterThan(0);
      }
    }
  });
});
