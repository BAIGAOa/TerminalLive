import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface RegionDef {
  id: string;
  neighbors: string[];
}

const WORLDS_DIR = join(process.cwd(), "resource", "worlds");

function loadRegions(world: string): RegionDef[] {
  return JSON.parse(
    readFileSync(join(WORLDS_DIR, world, "chronicle", "regions.json"), "utf8"),
  );
}

const worlds = readdirSync(WORLDS_DIR).filter((w) =>
  existsSync(join(WORLDS_DIR, w, "chronicle", "regions.json")),
);

/**
 * Content integrity: a world whose regions only list themselves makes
 * `canMove` unreachable and zeroes inter-region trade. Guard against the
 * whole cast silently regressing to self-only adjacency.
 */
describe("shipped world region graphs", () => {
  it("covers every world that ships regions", () => {
    expect(worlds.length).toBeGreaterThanOrEqual(9);
  });

  for (const world of worlds) {
    it(`${world}: no region is its own only neighbour`, () => {
      for (const r of loadRegions(world)) {
        expect(
          r.neighbors.some((n) => n !== r.id),
          `${r.id} has no real neighbour`,
        ).toBe(true);
      }
    });

    it(`${world}: adjacency is symmetric and references real regions`, () => {
      const regions = loadRegions(world);
      const byId = new Map(regions.map((r) => [r.id, r]));
      for (const r of regions) {
        for (const n of r.neighbors) {
          const other = byId.get(n);
          expect(other, `${r.id} -> unknown region ${n}`).toBeDefined();
          expect(
            other!.neighbors.includes(r.id),
            `${r.id} -> ${n} is not mirrored`,
          ).toBe(true);
        }
      }
    });
  }
});
