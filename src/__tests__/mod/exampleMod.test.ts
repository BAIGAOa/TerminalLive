import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSandboxed } from "../../core/plugin/evaluate.js";

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
  return evaluateSandboxed(source, { filename: join(dir, "index.js") });
}

/** Minimal ModContext stub capturing what the example mod registers. */
/**
 * A stand-in for the kernel's PluginContext, capturing what the example
 * registers. Kept in step with the real surface on purpose: this is the
 * contract a mod author writes against.
 */
function fakeCtx() {
  const axes: string[] = [];
  const lore: string[] = [];
  const commands: string[] = [];
  const views: string[] = [];
  const provided = new Map<string, unknown>();
  const listened: string[] = [];
  const stored: { value: unknown } = { value: undefined };
  return {
    ctx: {
      id: "example_mod",
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
      addPressureAxis: (def: { id: string }) => axes.push(def.id),
      addLore: (def: { id: string }) => lore.push(def.id),
      addCommand: (cmd: { name: string }) => commands.push(cmd.name),
      addStatusView: (id: string) => views.push(id),
      createEventClass: () => class FakeEvent {},
      services: {
        provide: (id: string, impl: unknown) => provided.set(id, impl),
      },
      storage: {
        read: (fallback: unknown) => stored.value ?? fallback,
        update: (fn: (s: any) => unknown, fallback: unknown) => {
          stored.value = fn(stored.value ?? fallback);
          return stored.value;
        },
      },
      events: { on: (event: string) => listened.push(event) },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      eventBus: { emit: vi.fn() },
      random: { pick: (items: unknown[]) => items[0] },
    } as any,
    axes,
    lore,
    commands,
    views,
    provided,
    listened,
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

  it("onInit also adds a console command, a status panel and a service", () => {
    const plugin = loadExample();
    const { ctx, commands, views, provided, listened } = fakeCtx();
    plugin.hooks.onInit(ctx);
    expect(commands).toContain("wonder");
    expect(views).toContain("example_wonder");
    expect(provided.has("example.blessing")).toBe(true);
    // Subscriptions go through the scoped bus, so unloading cleans them up.
    expect(listened).toContain("level:started");
  });

  it("its console command counts wishes through plugin storage", () => {
    const plugin = loadExample();
    const commands: { name: string; run: (c: any) => void }[] = [];
    const { ctx } = fakeCtx();
    (ctx as any).addCommand = (cmd: any) => commands.push(cmd);
    plugin.hooks.onInit(ctx);

    const printed: string[] = [];
    const repl = {
      args: [],
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
      print: (line: string) => printed.push(line),
      clear: () => {},
      run: () => {},
    };
    const wonder = commands.find((c) => c.name === "wonder")!;
    wonder.run(repl);
    wonder.run(repl);
    expect(printed[0]).toContain('"count":1');
    expect(printed[1]).toContain('"count":2');
  });
});
