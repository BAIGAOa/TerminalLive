import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModModule } from "../../core/mod/sandbox.js";

const dir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "resource",
  "example-mod",
);

function loadExample(): any {
  const source = readFileSync(join(dir, "index.js"), "utf-8");
  return loadModModule(source, { filename: join(dir, "index.js") });
}

/** Minimal ModContext stub capturing what the example mod registers. */
function fakeCtx() {
  const registered: string[] = [];
  const axes: string[] = [];
  const lore: string[] = [];
  return {
    ctx: {
      addPressureAxis: (def: { id: string }) => axes.push(def.id),
      addLore: (def: { id: string }) => lore.push(def.id),
      createEventClass: () => class FakeEvent {},
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      eventBus: { emit: vi.fn() },
    } as any,
    registered,
    axes,
    lore,
  };
}

describe("example mod template", () => {
  it("loads through the sandbox and declares an id", () => {
    const plugin = loadExample();
    expect(plugin.id).toBe("example_mod");
  });

  it("registers its custom event type", () => {
    const plugin = loadExample();
    const types = new Map<string, unknown>();
    const { ctx } = fakeCtx();
    plugin.registerEventTypes(
      { register: (name: string, ctor: unknown) => types.set(name, ctor) },
      ctx,
    );
    expect(types.has("ExampleKindness")).toBe(true);
  });

  it("onInit adds a pressure axis and a lore entry", () => {
    const plugin = loadExample();
    const { ctx, axes, lore } = fakeCtx();
    plugin.hooks.onInit(ctx);
    expect(axes).toContain("pr_example_wonder");
    expect(lore).toContain("lore_example_note");
  });

  it("onYear fires a toast every decade", () => {
    const plugin = loadExample();
    const { ctx } = fakeCtx();
    plugin.hooks.onYear({ age: 10 } as any, ctx);
    plugin.hooks.onYear({ age: 11 } as any, ctx);
    expect(ctx.eventBus.emit).toHaveBeenCalledTimes(1);
    expect(ctx.eventBus.emit.mock.calls[0][0]).toBe("toast");
  });
});
