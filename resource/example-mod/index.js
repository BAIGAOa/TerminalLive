// Example mod for TerminalLive.
//
// This file runs inside a sandboxed V8 context: `process`, `global`, `fs` and
// every module except react / ink / ink-cartridge are unavailable. Everything
// you need arrives through the PluginContext your hooks receive.
//
// Capabilities in mod.json decide what you may touch: without "ui" you cannot
// add a panel, without "world" you cannot add an axis or lore, without
// "storage" nothing persists. Ask for what you use — the game logs anything
// you reach for without declaring it.
//
// Declare "trust": "full" to run outside the sandbox with a real require().
// That is what deep plugins need (subclassing game classes, native modules);
// it is code the player has agreed to run, so it is asked for out loud.
//
// Edit this file (or the bundled events/language) with the game running and run
// the `mods-watch` console command to see it hot-reload.

module.exports = {
  id: "example_mod",

  // Register a brand-new event type, then reference it from events/example.json
  // with `"type": "ExampleKindness"`.
  registerEventTypes(registry, ctx) {
    const ExampleKindness = ctx.createEventClass({
      apply(player) {
        player.applyDelta({ happiness: 3, reputation: 1 });
      },
      getWeight(player) {
        // Only meaningful for children.
        return player.age < 13 ? 0.8 : 0;
      },
    });
    registry.register("ExampleKindness", ExampleKindness);
  },

  // Register a brand-new NPC archetype, then reference it from
  // npcs/guardian.json with `"type": "example_guardian"` (+ custom `params`).
  // A mod can also `class X extends ctx.npcBase { … }` and register that class.
  registerNpcTypes(registry, ctx) {
    const ExampleGuardian = ctx.createNpcClass({
      // Custom field: `params.favor` picks the guardian's blessing.
      parseParams(self, params) {
        self.favor = typeof params.favor === "string" ? params.favor : "shield";
      },
      traits: { warmth: 0.85, ambition: 0.3, stability: 0.9, sociability: 0.4 },
      // The guardian only enters the player's life at age 6.
      knowsFromAge: 6,
      autonomyMinAge: 6,
      // A rare, quiet act of protection — real good news for the player.
      peerScheme(self) {
        if (ctx.random.next() >= 0.08) return [];
        const effects =
          self.favor === "hearth"
            ? { happiness: 6, depressionValue: -4 }
            : { health: 4, happiness: 3 };
        return [
          {
            actorId: self.id,
            player: { effects, toastKey: "example.npc.guardian.watch" },
            logKey: "example.npc.guardian.watch",
          },
        ];
      },
    });
    registry.register("example_guardian", ExampleGuardian);
  },

  hooks: {
    onInit(ctx) {
      // Add a hidden-score axis (see the Pressures panel in-game).
      ctx.addPressureAxis({
        id: "pr_example_wonder",
        labelKey: "example.pressure.wonder",
        class: "culture",
        min: 0,
        max: 100,
        initial: 50,
        baseline: 50,
        drift: 0.05,
      });

      // Add a codex entry, unlocked after year 5.
      ctx.addLore({
        id: "lore_example_note",
        titleKey: "example.lore.title",
        bodyKey: "example.lore.body",
        category: "example",
        unlock: { kind: "year", year: 5 },
      });

      // Publish a service other plugins can consume. Any plugin that depends on
      // this one can `ctx.services.require("example.blessing")` and get it back;
      // the kernel never needs to know what it means.
      ctx.services.provide("example.blessing", {
        describe: () => ctx.random.pick(["shield", "hearth", "harvest"]),
      });

      // A console (P) command. Replacing a built-in name takes it over: a mod
      // that registers "seed" displaces the game's own.
      ctx.addCommand({
        name: "wonder",
        summary: "example.cmd.wonder",
        usage: "wonder",
        run: (c) => {
          const state = ctx.storage.read({ seen: 0 });
          const next = ctx.storage.update((s) => ({ seen: (s.seen ?? 0) + 1 }), state);
          c.print(c.t("example.cmd.wonder", { count: next.seen }), "success");
        },
      });

      // A panel in the in-game status screen, under its own id. Providing an id
      // the game already uses ("attributes", "skills", …) replaces that panel.
      const React = require("react");
      const { Box, Text } = require("ink");
      const WonderPanel = () =>
        React.createElement(
          Box,
          null,
          React.createElement(
            Text,
            { color: "magenta" },
            `${ctx.t("example.panel.title")}  ${ctx.random.pick(["a", "b", "c"])}`,
          ),
        );
      ctx.addStatusView("example_wonder", WonderPanel);

      // The event bus, scoped to this plugin: everything subscribed here is
      // torn down automatically when the plugin unloads or hot-reloads.
      ctx.events.on("level:started", ({ levelId }) => {
        ctx.logger.info(`进入了世界 ${levelId}`);
      });

      ctx.logger.info("example_mod 初始化完成");
    },

    // A life ended (death, or a completed world).
    onLifeEnd({ reason, age }, player, ctx) {
      ctx.logger.info(`一生结束：${reason} @ ${age}`);
    },

    onPlayerCreated(player, ctx) {
      ctx.logger.info(`新生命诞生：年龄 ${player.age}`);
    },

    onYear(player, ctx) {
      // Every decade, nudge the hidden axis and show a toast.
      if (player.age > 0 && player.age % 10 === 0) {
        ctx.eventBus.emit("toast", {
          textKey: "example.toast.decade",
          kind: "info",
        });
      }
    },
  },
};
