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
