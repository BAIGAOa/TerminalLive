// Example mod for TerminalLive.
//
// This file runs inside a sandboxed V8 context: `process`, `global`, `fs` and
// every module except react / ink / ink-cartridge are unavailable. Everything
// you need arrives through the ModContext your hooks receive.
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

      ctx.logger.info("example_mod 初始化完成");
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
