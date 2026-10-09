import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import PluginHost from "../../core/plugin/PluginHost.js";
import FirstPartyPlugins from "../../core/plugin/FirstParty.js";
import KernelServices from "../../core/plugin/kernel.js";
import { definePluginManifest } from "../../core/plugin/manifest.js";
import { SettingRegistry } from "../../core/registry/SettingRegistry.js";
import KeyActionRegistry from "../../core/registry/KeyActionRegistry.js";
import ReplRegistry from "../../core/repl/ReplRegistry.js";
import EventTypeRegistry from "../../core/mod/EventTypeRegistry.js";
import { UiSlotRegistry } from "../../core/plugin/ui.js";
import type { Plugin } from "../../core/plugin/types.js";

/** The composition root's job, done by hand: hand plugins the game services. */
function installKernel(): void {
  const keyActions = container.resolve(KeyActionRegistry);
  container.resolve(KernelServices).install({
    random: {} as never,
    director: {} as never,
    bus: {} as never,
    config: {} as never,
    worlds: {} as never,
    events: () => null,
    chronicle: {} as never,
    politics: {} as never,
    economy: {} as never,
    health: {} as never,
    narrative: {} as never,
    chains: {} as never,
    regions: {} as never,
    lineage: {} as never,
    careers: {} as never,
    keyActions,
  });
}

function mount(plugin: Plugin, requests: Record<string, string> = {}): void {
  container.resolve(FirstPartyPlugins).register({
    manifest: definePluginManifest({
      id: plugin.id,
      nameKey: `${plugin.id}.name`,
      capabilities: ["ui", "kernel"],
      dependencies: requests,
    }),
    plugin,
  });
}

beforeEach(() => {
  container.reset();
  installKernel();
});

describe("PluginHost — a plugin that provides", () => {
  const provider: Plugin = {
    id: "test.provider",
    hooks: {
      onInit(ctx) {
        ctx.kernel.keyActions.set("tea", {
          id: "tea",
          labelKey: "tea.label",
          defaultKey: "t",
        });
        ctx.services.provide("test.brew", { strength: 11 });
        ctx.addSetting("tea", {
          component: (() => null) as never,
          nameKey: "tea.setting",
        });
      },
    },
  };

  it("mounts it and applies what it registered", () => {
    mount(provider);
    const host = container.resolve(PluginHost);
    host.loadEnabled();

    expect(host.isMounted("test.provider")).toBe(true);
    expect(container.resolve(KeyActionRegistry).tryGet("tea")?.defaultKey).toBe("t");
    expect(container.resolve(SettingRegistry).has("tea")).toBe(true);
    expect(host.serviceIds()).toContain("test.brew");
  });

  it("hands another plugin the service, in dependency order", () => {
    // The keybindings plugin's whole point: the shortcut list is a service
    // other plugins add to, and a declared dependency guarantees load order.
    let received: { strength: number } | undefined;
    mount(provider);
    mount(
      {
        id: "test.consumer",
        hooks: {
          onInit(ctx) {
            received = ctx.services.require<{ strength: number }>("test.brew");
            ctx.kernel.keyActions.set("coffee", {
              id: "coffee",
              labelKey: "coffee.label",
              defaultKey: "c",
            });
          },
        },
      },
      { "test.provider": "*" },
    );

    container.resolve(PluginHost).loadEnabled();

    expect(received?.strength).toBe(11);
    const actions = container.resolve(KeyActionRegistry).effective().map((a) => a.id);
    expect(actions).toEqual(["tea", "coffee"]);
  });

  it("retracts the provider's service when the plugin unloads", () => {
    mount(provider);
    const host = container.resolve(PluginHost);
    host.loadEnabled();
    expect(host.serviceIds()).toContain("test.brew");

    host.unloadAll();
    expect(host.serviceIds()).not.toContain("test.brew");
    expect(host.loadedIds()).toEqual([]);
    expect(container.resolve(UiSlotRegistry).slotIds()).toEqual([]);
  });

  it("isolates a plugin that throws, and keeps loading the rest", () => {
    mount({
      id: "test.broken",
      hooks: {
        onInit() {
          throw new Error("boom");
        },
      },
    });
    mount(provider);

    const host = container.resolve(PluginHost);
    host.loadEnabled();

    // The throwing plugin is still mounted (its hooks are isolated per call),
    // and the healthy one ran.
    expect(host.isMounted("test.provider")).toBe(true);
    expect(container.resolve(SettingRegistry).has("tea")).toBe(true);
  });

  it("takes a plugin's settings page and command back on unload", () => {
    // Without this, disabling a plugin leaves its page and its console command
    // live — pointing at code the host believes it unloaded.
    mount({
      id: "test.contrib",
      hooks: {
        onInit(ctx) {
          ctx.addSetting("contrib", {
            component: (() => null) as never,
            nameKey: "contrib.setting",
          });
          ctx.addCommand({
            name: "contrib-cmd",
            summary: "contrib.cmd",
            usage: "contrib-cmd",
            run: () => {},
          });
        },
      },
    });
    const settings = container.resolve(SettingRegistry);
    const repl = container.resolve(ReplRegistry);
    const host = container.resolve(PluginHost);

    host.loadEnabled();
    expect(settings.has("contrib")).toBe(true);
    expect(repl.resolve("contrib-cmd")).toBeDefined();

    host.unloadAll();
    expect(settings.has("contrib")).toBe(false);
    expect(repl.resolve("contrib-cmd")).toBeUndefined();
  });

  it("gives a displaced built-in back when the plugin unloads", () => {
    const repl = container.resolve(ReplRegistry);
    const builtin = {
      name: "seed",
      summary: "builtin.seed",
      run: () => {},
    };
    repl.set(builtin);

    mount({
      id: "test.override",
      hooks: {
        onInit(ctx) {
          ctx.addCommand({ name: "seed", summary: "plugin.seed", run: () => {} });
        },
      },
    });
    const host = container.resolve(PluginHost);
    host.loadEnabled();
    expect(repl.resolve("seed")?.summary).toBe("plugin.seed");

    host.unloadAll();
    expect(repl.resolve("seed")?.summary).toBe("builtin.seed");
  });

  it("runs onDispose before dropping the plugin", () => {
    const seen: string[] = [];
    mount({
      id: "test.cleanup",
      hooks: {
        onInit: () => seen.push("init"),
        onDispose: () => seen.push("dispose"),
      },
    });
    const host = container.resolve(PluginHost);
    host.loadEnabled();
    host.unloadAll();
    expect(seen).toEqual(["init", "dispose"]);
  });
});

describe("hot reload of plugin type registrations", () => {
  it("replaces an event type instead of dropping the new class", () => {
    // The bug this guards: `register` throws on a duplicate, the throw is
    // isolated, and the re-registered (edited) class is discarded — so a plugin
    // could never change an event type without a restart.
    const eventTypes = container.resolve(EventTypeRegistry);
    const host = container.resolve(PluginHost);
    const versions: string[] = [];

    const mountVersion = (tag: string) => {
      container.resolve(FirstPartyPlugins).register({
        manifest: definePluginManifest({
          id: "test.types",
          nameKey: "test.types",
          capabilities: ["events"],
        }),
        plugin: {
          id: "test.types",
          registerEventTypes: (registry) => {
            versions.push(tag);
            registry.register("TestKind", class {} as never);
          },
        },
      });
    };

    mountVersion("v1");
    host.loadEnabled();
    expect(eventTypes.has("TestKind")).toBe(true);
    host.unloadAll();
    expect(eventTypes.has("TestKind")).toBe(false);

    // A reload must land v2, not silently keep v1.
    container.reset();
    installKernel();
    container.resolve(FirstPartyPlugins).register({
      manifest: definePluginManifest({
        id: "test.types",
        nameKey: "test.types",
        capabilities: ["events"],
      }),
      plugin: {
        id: "test.types",
        registerEventTypes: (registry) => {
          versions.push("v2");
          registry.register("TestKind", class {} as never);
        },
      },
    });
    const host2 = container.resolve(PluginHost);
    host2.loadEnabled();
    expect(container.resolve(EventTypeRegistry).has("TestKind")).toBe(true);
    expect(versions).toEqual(["v1", "v2"]);
  });
});
