# Plugin & Mod Development Guide

TerminalLive is a microkernel: its events, worlds, status screen and console
commands are all **plugins**, and so is anything you write. A plugin can add
custom events, translations, UI screens, achievements and arbitrary game logic —
and can **replace** the ones the game ships with.

Plugins come from three places, and the only difference between them is where
they were found:

| Source | Location | Written in |
|--------|----------|-----------|
| The game's own features | `src/plugins/` (compiled in) | TypeScript |
| Shipped plugins | `resource/plugins/<id>/plugin.json` | JSON, optionally `index.js` |
| **Your mod** | `~/.mod_live/<folder>/mod.json` | `index.js` |

They share one manifest schema, one capability model and one context API. This
guide is for the third row — but everything here applies to the other two.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Directory Structure](#directory-structure)
- [Manifest (`mod.json`)](#manifest-modjson)
- [Capabilities & Trust](#capabilities--trust)
- [Extending & Replacing](#extending--replacing)
- [Talking to Other Plugins](#talking-to-other-plugins)
- [Adding Events (JSON)](#adding-events-json)
  - [Event Definition Reference](#event-definition-reference)
  - [Post-Event Chains](#post-event-chains)
- [Plugin Entry (`index.js`)](#plugin-entry-indexjs)
  - [The `ModPlugin` Object](#the-modplugin-object)
  - [Lifecycle Hooks](#lifecycle-hooks)
  - [Registering Custom Event Types](#registering-custom-event-types)
  - [Registering Custom NPC Types](#registering-custom-npc-types)
  - [Registering Custom UI Screens](#registering-custom-ui-screens)
  - [Registering Achievements](#registering-achievements)
  - [Registering Filters, Algorithms & Conditions](#registering-filters-algorithms--conditions)
  - [Module-Level Screen Transitions](#module-level-screen-transitions)
- [The `ModContext` API](#the-modcontext-api)
- [Translation Files](#translation-files)
- [Developing with TypeScript](#developing-with-typescript)
- [Sandbox & Hot-Reload](#sandbox--hot-reload)
- [Enabling & Testing Your Mod](#enabling--testing-your-mod)
- [Player Object Reference](#player-object-reference)

---

## Quick Start

```bash
mkdir -p ~/.mod_live/my-mod
cd ~/.mod_live/my-mod
npm init -y
```

Create a `mod.json` and an `index.js` (see below). That's it — launch the game and enable your mod from **Settings → Mod Manager**.

---

## Directory Structure

```
~/.mod_live/
└── my-mod/
    ├── mod.json          # Required — mod manifest
    ├── index.js          # Optional — plugin entry (lifecycle hooks & custom logic)
    ├── events/           # Optional — JSON event definitions
    │   └── custom.json
    └── language/         # Optional — translation files
        ├── en_US.json
        └── zh_CN.json
```

---

## Manifest (`mod.json`)

Every mod must have a `mod.json` at its root.

```json
{
  "id": "my-mod",
  "name": "My Mod",
  "version": "1.0.0",
  "apiVersion": 1,
  "description": "An example mod",
  "main": "index.js",
  "author": "your-name",
  "dependencies": { "other-mod": "^1.0.0" }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | — | Stable id used in `dependencies`; defaults to the folder name. |
| `name` | ✅ | Display name (Mod Manager, logs). |
| `version` | — | Semantic version; informational. Defaults to `0.0.0`. |
| `apiVersion` | — | Game mod API version this mod targets. Defaults to `1`. |
| `description` | — | Short description shown in the Mod Manager. |
| `main` | — | Plugin entry file (relative to mod root). Defaults to `index.js`. |
| `author` | — | Displayed in the Mod Manager. |
| `dependencies` | — | `{ "modId": "semver-range" }`. Dependencies load first; a mod whose dependency is **missing** (or that sits on a **dependency cycle**) is skipped with a warning instead of crashing the game. Ids are shared with the plugins the game ships, so a mod may depend on one. |
| `capabilities` | — | What the mod may touch: `events`, `items`, `npcs`, `levels`, `world`, `random`, `ui`, `storage`, `kernel`. **Omitted = the four content ones** (`events`, `items`, `npcs`, `levels`) — a mod that never declares them cannot add an axis, lore, a panel or a console command. |
| `trust` | — | `"sandbox"` (default) or `"full"`. See [Capabilities & Trust](#capabilities--trust). |

The same schema is what the game's own plugins use: a plugin shipped in
`resource/plugins/` reads the identical fields from `plugin.json`. "Mod" is just
the name for a plugin that came from `~/.mod_live/`.

A mod is valid if it ships a `mod.json`, an `index.js`, or any resource pack directory
(`events/`, `items/`, `npcs/`, `levels/`, `achievements/`, `pressures/`, `language/`).

---

## Adding Events (JSON)

Place `.json` files in `events/`. Each file defines **one event instance** — or an **array** of them. The game loads them alongside built-in events and feeds them into the same weighted random engine.

### Minimal Example

```json
{
  "type": "BirthEvent",
  "id": "my-custom-event",
  "nameKey": "events.myEvent",
  "rangeKey": ["10-50"],
  "weight": 0.3,
  "once": false,
  "predecessorEvent": null,
  "excludedIds": [],
  "postEvent": null
}
```

### Event Definition Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `string` | **required** | Event class name. Built-ins: `BirthEvent`, `ChoiceEvent` (branching), `EffectEvent` (declarative effects), `AcademicStressEvent`, `AcademicAnger` — or a custom type registered via `registerEventTypes`. |
| `id` | `string` | **required** | Globally unique event identifier. |
| `nameKey` | `string` | — | Translation key for the in-game log message. |
| `textKey` | `string` | — | Translation key for the narrative text shown with the event / its choice prompt. |
| `choices` | `object[]` | — | Branching options. When present the event pauses and the player picks one. See [Choices](#choices). |
| `rangeKey` | `string[]` | `["0-100"]` | Age ranges where this event can trigger. Format: `"min-max"` (e.g. `["5-12", "18-25"]`). |
| `weight` | `number` | `0.5` | Relative probability. Higher = more likely to be selected from the candidate pool. |
| `once` | `boolean \| string[]` | `false` | `true` = fires once globally and never again. `["5-12", "18-25"]` = fires once per listed range. |
| `predecessorEvent` | `string \| null` | `null` | This event only becomes eligible after the specified predecessor event has been triggered. |
| `excludedIds` | `string[]` | `[]` | Event IDs that become permanently blocked once this event triggers. |
| `postEvent` | `string \| object[] \| null` | `null` | Event(s) automatically scheduled after this one. See [Post-Event Chains](#post-event-chains). |
| `params` | `Record<string, unknown>` | — | Arbitrary key-value data passed to the event's `IncidentParameter`. |

### Post-Event Chains

The `postEvent` field can be a single event ID (string) or an array of post-event objects:

```json
{
  "postEvent": [
    { "incident": "follow-up-event-1", "delay": 0, "weight": 0.5 },
    { "incident": "follow-up-event-2", "delay": 2, "weight": 0.8 }
  ]
}
```

| Field | Description |
|-------|-------------|
| `incident` | Event ID to schedule. |
| `delay` | Number of rounds to wait before the event becomes eligible (default: `0`). |
| `weight` | Override weight for the scheduled event (uses the event's own weight if omitted). |

### Choices

An event with `choices` (usually `type: "ChoiceEvent"`) pauses the turn and opens a modal
dialog. Each option can gate on stats, change stats, grant or remove items, adjust a
relationship, apply a timed effect, set a flag, and schedule a post-event.

```json
{
  "type": "ChoiceEvent",
  "id": "my-choice",
  "nameKey": "ev.myChoice",
  "textKey": "ev.myChoice.text",
  "rangeKey": ["14-40"],
  "weight": 1,
  "once": true,
  "choices": [
    {
      "id": "bold",
      "labelKey": "ev.myChoice.opt.bold",
      "require": [{ "prop": "money", "gte": 200 }],
      "effects": { "money": -200, "happiness": 10 },
      "items": ["item_ring"],
      "relationship": { "npc": "npc_partner", "delta": 15 },
      "buff": { "id": "fx_blessed", "turns": 5 },
      "flag": "did_something",
      "postEvent": [
        { "incident": "follow-up-a", "weight": 1 },
        { "incident": "follow-up-b", "weight": 1 }
      ],
      "noteKey": "ev.myChoice.note.bold"
    },
    {
      "id": "safe",
      "labelKey": "ev.myChoice.opt.safe",
      "effects": { "happiness": 2 }
    }
  ]
}
```

| Choice field | Description |
|--------------|-------------|
| `id` | Unique id within the event (the player's pick is identified by it). |
| `labelKey` | Translation key for the option text. |
| `require` | Array of `{ prop, gte?, lte? }` gates. Unmet non-`hidden` options show as locked; `"hidden": true` omits them entirely. |
| `effects` | Stat deltas (`health`, `money`, `intelligence`, `social`, `fitness`, `happiness`, `angerValue`, …). |
| `items` / `removeItems` | Item ids to grant / remove. |
| `relationship` | `{ "npc": "<npcId>", "delta": <number> }`. |
| `buff` | `{ "id": "<effectId>", "turns": <number> }`. |
| `flag` | Sets a life flag (used by achievements and other gates). |
| `postEvent` | Post-event spec (same shape as the event-level `postEvent`). |
| `noteKey` | Translation key for the outcome line echoed to the journal. |

### Declarative effect events

`type: "EffectEvent"` runs no code — it applies an effect payload from `params`. Use it for
simple events that just move the numbers:

```json
{
  "type": "EffectEvent",
  "id": "found-money",
  "nameKey": "ev.foundMoney",
  "rangeKey": ["16-70"],
  "weight": 0.8,
  "params": {
    "effects": { "money": 50, "happiness": 2 },
    "relationship": { "npc": "npc_friend", "delta": 3 },
    "buff": { "id": "fx_blessed", "turns": 4 },
    "items": ["item_snack"],
    "flag": "lucky_find"
  }
}
```

### Post-only events

Events meant only to be scheduled (never rolled randomly) can use an unreachable age range
such as `["200-201"]`, since the player's age never reaches it directly.

---

## Items & NPCs (JSON)

Drop `items/*.json` and `npcs/*.json` files in your mod (each file an object or array) to add
items and relationship characters.

```json
// items/tea.json
{
  "id": "item_tea",
  "labelKey": "item.tea",
  "descKey": "item.tea.desc",
  "icon": "🍵",
  "usable": true,
  "consumable": true,
  "effects": { "happiness": 4 },
  "buff": { "id": "fx_focus", "turns": 2 }
}
```

```json
// npcs/neighbor.json
{
  "id": "npc_neighbor",
  "labelKey": "npc.neighbor",
  "descKey": "npc.neighbor.desc",
  "roleKey": "npc.role.friend",
  "initial": 25
}
```

Items and NPCs referenced by events (via `items` / `relationship`) must be registered here
(or shipped as built-ins).

---

## Plugin Entry (`index.js`)

The entry file (specified by `main` in `mod.json`) exports a **`ModPlugin`** object. The game calls its methods at specific lifecycle points.

### The `ModPlugin` Object

```javascript
module.exports = {
  id: "my-mod",

  // Optional: register custom event types so JSON events can reference them
  registerEventTypes(registry, ctx) { /* ... */ },

  // Optional: lifecycle hooks
  hooks: {
    onInit(ctx) { /* ... */ },
    onPlayerCreated(player, ctx) { /* ... */ },
    onPlayerUpdate(player, ctx) { /* ... */ },
    onIncidentTrigger(incident, player, ctx) { /* ... */ },
    onIncidentExecuted(incident, player, ctx) { /* ... */ },
  },
};
```

| Property | Required | Description |
|----------|----------|-------------|
| `id` | ✅ | Unique mod identifier. Must match `name` in `mod.json`. |
| `registerEventTypes` | — | Called once during mod loading. Use `registry.register(name, Class)` to register custom event classes. |
| `hooks` | — | Collection of lifecycle callbacks. All hooks are optional — implement only what you need. |

### Lifecycle Hooks

| Hook | When Called | Use Case |
|------|-------------|----------|
| **`onInit(ctx)`** | After mod is loaded, before the game starts. | Initialisation, subscribing to the event bus, registering screens / settings / achievements / world content. |
| **`onPlayerCreated(player, ctx)`** | After the player object is first created. | Modify initial player state (stats, name, etc.). |
| **`onPlayerUpdate(player, ctx)`** | Every round, after the player ticks. | Per-turn side effects, stat monitoring, threshold logic. |
| **`onYear(player, ctx)`** | End of each year (after events resolve). | Yearly bookkeeping, custom economy/weather reactions. |
| **`onChoice(incident, optionId, player, ctx)`** | When the player resolves a choice. | React to specific branches, track decisions. |
| **`onIncidentTrigger(incident, player, ctx)`** | Before an incident is executed. | Conditionally block events. Return `false` to prevent execution; return nothing (or `true`) to allow it. |
| **`onIncidentExecuted(incident, player, ctx)`** | After an incident has been executed. | Logging, follow-up actions, chaining custom effects. |
| **`onWorldStart(levelId, player, ctx)`** | A world starts: a new life, or resuming a save. | Per-life setup, seeding your own state. |
| **`onLifeEnd({ reason, age }, player, ctx)`** | The life ended — `reason` is `"death"` or `"complete"`. | Epilogues, persisting a lifetime summary to `ctx.storage`. |
| **`onDispose(ctx)`** | The plugin is unloaded (hot reload, or a settings change). | Releasing anything the kernel does not own for you. |

> The world/turn/lifecycle hooks are conveniences over the event bus. Anything
> else is a subscription away: `ctx.events.on("turn:ended", …)`. Subscriptions
> made through `ctx.events` are **automatically torn down** when the plugin
> unloads, so a hot reload can never leave a listener pointing at dead code.

> Hooks run in **dependency order** (dependencies first), then alphabetical among independent mods. Every hook call is **error-isolated**: a mod that throws is logged and skipped without taking down the game.

### Registering Custom Event Types

Use `registerEventTypes(registry, ctx)` to define event classes that your JSON events can reference via the `type` field.

```javascript
registerEventTypes(registry, ctx) {
  const MyEvent = ctx.createEventClass({
    apply(player, self) {
      // self.params contains the params from your JSON definition
      player.fortune += 100;
      ctx.logger.info(`Custom event "${self.id}" triggered!`);
    },
    getWeight(player, self) {
      // Dynamic weight based on player state (optional)
      return player.angerValue > 50 ? 0.6 : 0.1;
    },
  });

  registry.register("MyEvent", MyEvent);
}
```

`ctx.createEventClass(def)` accepts:

| Method | Required | Signature | Description |
|--------|----------|-----------|-------------|
| `apply` | ✅ | `(player: Player, self: Incident) => void` | The effect to apply when the event fires. |
| `getWeight` | — | `(player: Player, self: Incident) => number` | Override the JSON `weight` with a dynamic value computed from player state. |

The returned constructor can be passed directly to `registry.register()`.

### Registering Custom NPC Types

NPCs work exactly like events: an NPC's JSON `type` field picks its class. Use
`registerNpcTypes(registry, ctx)` to add your own archetype. When `type` is
omitted the game infers one from `roleKey` (family / friend / rival / …), so old
JSON keeps working.

```javascript
registerNpcTypes(registry, ctx) {
  const Guardian = ctx.createNpcClass({
    // Custom fields are read from the NPC's JSON `params`.
    parseParams(self, params) {
      self.favor = typeof params.favor === "string" ? params.favor : "shield";
    },
    traits: { warmth: 0.85, ambition: 0.3, stability: 0.9, sociability: 0.4 },
    knowsFromAge: 6,   // the player only meets them at age 6 — gates all agency
    autonomyMinAge: 6,
    // A yearly behaviour against a peer and/or the player.
    peerScheme(self, view) {
      if (ctx.random.next() >= 0.08) return [];
      return [{
        actorId: self.id,
        player: { effects: { health: 4, happiness: 3 }, toastKey: "my.npc.watch" },
        logKey: "my.npc.watch",
      }];
    },
    // React to another NPC's life event this year (optional).
    reactToPeer(self, ev, view) { return null; },
  });
  registry.register("my_guardian", Guardian);
}
```

Then reference it from an `npcs/` file:

```json
[{ "id": "npc_guardian", "type": "my_guardian", "labelKey": "my.npc",
   "descKey": "my.npc.desc", "initial": 25, "params": { "favor": "hearth" } }]
```

`ctx.createNpcClass(def)` accepts:

| Field | Description |
|-------|-------------|
| `parseParams(self, params)` | Read custom fields out of the JSON `params`. |
| `traits` | Personality `{ warmth, ambition, stability, sociability }` (−1…1). |
| `knowsFromAge` / `knowsUntilAge` | The player-age window in which the player knows this NPC. Outside it the NPC is hidden and never acts. |
| `autonomyMinAge` / `autonomyMaxAge` | Age window applied to this NPC's autonomy. |
| `peerScheme(self, view)` | Yearly behaviour; return `NpcSchemeResult[]` to act on a peer (`targetId` + `edge` / `target` deltas) and/or the player (`player: { effects, karma, buff, bond, flags, … }`). |
| `reactToPeer(self, ev, view)` | React to another NPC's life event this year. |

The `view` argument exposes `random`, `peers`, `life(id)`, `edge(a, b)`,
`bond(id)`, `playerAffinity(id)` and `knowsPlayer(id)`. A scheme's `player`
impact is applied only when the player actually knows the acting NPC, so age
gating comes for free. A mod that wants full control can instead
`class MyNpc extends ctx.npcBase { … }` and pass the class to
`registry.register(name, MyNpc)`.

> Requires the **`npcs`** capability. Mod `npcs/` JSON is parsed only after
> `registerNpcTypes` has run, so `"type": "my_guardian"` always resolves.

### Registering Custom UI Screens

Mods can add entirely new screens to the game's navigation system.

```javascript
hooks: {
  onInit(ctx) {
    ctx.registerScreen("myModSettings", {
      component: MySettingsComponent,  // An Ink React component
      nameKey: "myMod.settingsTitle",  // Translation key for display
      highlightId: "mySettings",       // Optional: highlight in menu
      hide: false,                     // Optional: hide from menus (default false)
    });
  },
},
```

To navigate to your screen programmatically:

```javascript
ctx.navigateTo("myModSettings");
```

Built-in scene IDs: `"menu"`, `"game"`, `"config"`, `"language"`, `"achievement"`.

### Registering Achievements

```javascript
hooks: {
  onInit(ctx) {
    ctx.registerAchievement({
      id: "my-custom-achievement",
      nameKey: "achievements.myCustom",
      descriptionKey: "achievements.myCustom.desc",
      category: "custom",
      // Unlock condition logic is defined in the Achievement object
    });
  },
},
```

### Registering Filters, Algorithms & Conditions

The `ModContext` exposes lower-level extension points for advanced mods:

```javascript
// Add a custom incident filter (decides whether an event can be selected)
ctx.addFilter("myFilter", () => new MyIncidentFilter());

// Add a custom event algorithm (replaces the default weighted-random selection)
ctx.addAlgorithm("myAlgorithm", (deps) => new MyAlgorithm(deps));

// Add a custom condition (reusable check for achievements, filters, etc.)
ctx.addCondition("myCondition", MyConditionClass, myConditionSchema);
```

---

## Capabilities & Trust

The game is a microkernel: everything beyond its core — events, worlds, the
status screen, the console commands — is a plugin, and so is your mod. What
separates them is only **where they were found**, never what they may do.

That makes two questions worth asking out loud.

### What may a plugin touch?

`capabilities` in the manifest. Nothing is granted implicitly:

| Capability | Unlocks |
|-----------|---------|
| `events` | `createEventClass`, `addCondition`, `addAlgorithm`, `addFilter`, event JSON |
| `npcs` | `createNpcClass`, `registerNpcType`, NPC JSON |
| `items` / `levels` | the matching content folders |
| `world` | `addPressureAxis`, `addPressureRule`, `addLore`, `addFateArc`, `addWorldEvent`, `addTrait`, `addWorldRule` |
| `ui` | `registerScreen`, `overrideScreen`, `addStatusView`, `addSetting`, `addCommand` |
| `storage` | `ctx.storage` (per-plugin persistence) |
| `random` | `ctx.random`, a forked deterministic stream |
| `kernel` | `ctx.kernel` — the live game systems |

Reaching for something you did not declare is refused with a warning naming the
capability — never a crash.

### How much does the game trust it?

`trust` decides how the entry file is evaluated:

| `trust` | Evaluation |
|---------|-----------|
| `"sandbox"` (default) | a `node:vm` context; `require` limited to react / ink / ink-cartridge |
| `"full"` | plain host evaluation with a real `require`, and access to anything Node gives you |

Deep plugins need `"full"`: the sandbox lives in a separate realm, where
`instanceof` against a game class is false and `class X extends SomeGameClass`
produces something the game does not recognise as its own.

Declaring `"full"` is asking the player for permission. They can also grant it
the other way: **Settings → Plugins**, select a plugin, press `T`. That is the
only place trust lives, and it is stored in `config.json` as `trustedPlugins`.
A player who wants no exceptions at all can force everything into the sandbox.

---

## Extending & Replacing

Adding things is the easy half. **Replacing** is what makes a plugin able to own
a feature rather than decorate it, and every one of these displaces a built-in.

### Take over a screen

```js
// The game publishes its main screens as slots. Provide one and yours renders
// instead — the built-in never mounts.
ctx.overrideScreen("screen.main-menu", MyMenu);
```

The slots are `screen.main-menu`, `screen.world-selection`, `screen.world-game`
and `screen.settings`. A higher `priority` on `overrideScreen` wins over a
plain one; with equal priority the newest registration wins, which is why the
game registers its own screens first.

### Replace a status panel

```js
// Same id as a built-in panel = you own that panel now ("attributes",
// "skills", "inventory", "relationships", …). A new id adds one.
ctx.addStatusView("inventory", MyInventoryPanel);
```

### Replace a console command

```js
// Same name = you own it, aliases included: the built-in `seed` is gone.
ctx.addCommand({
  name: "seed",
  summary: "my.seed",
  usage: "seed <number>",
  complete: (args) => args.length ? [] : ["42", "1337"],
  run: (c) => c.print(`seeded ${c.args[0]}`, "success"),
});
```

Commands registered by plugins appear in `help` and get Tab/Enter completion
and the description line under the console, exactly like the built-ins.

### Replace a settings page

```js
ctx.addSetting("playerConfig", { component: MyScreen, nameKey: "my.setting" });
```

---

## Talking to Other Plugins

Plugins extend each other, not just the game.

```js
// Publish an interface. The kernel never learns what it means.
ctx.services.provide("economy.prices", { wheat: 3, iron: 11 });

// Consume someone else's. `require` throws a named error if the provider is
// not loaded — which is what you want for a declared dependency.
const prices = ctx.services.require("economy.prices");
```

Declare `dependencies: { "their-plugin": "*" }` in your manifest so it loads
first, and the service is guaranteed to be there.

One is provided by the game, and it shows what services are for: the keybindings
plugin publishes `ui.keyactions`, so a mod with a screen of its own can offer a
rebindable hotkey and it appears in **Settings → Key bindings**, conflict
checking included.

```js
module.exports = {
  id: "my-mod",
  // The provider must load first.
  hooks: {
    onInit(ctx) {
      const keys = ctx.services.require("ui.keyactions");
      keys.add({ id: "my-mod.open", labelKey: "my.open", defaultKey: "o" });
    },
  },
};
```

With `"dependencies": { "core.keybindings": "*" }` in your manifest, and
`"labelKey": "my.open"` in your `language/*.json`, the shortcut is listable,
rebindable, and checked for collisions against the built-ins.

### Persist your own data

```js
const seen = ctx.storage.read({ worlds: [] });          // needs "storage"
if (!seen.worlds.includes(levelId)) {
  ctx.storage.update((s) => ({ worlds: [...s.worlds, levelId] }), seen);
}
```

One JSON document per plugin, written for you — no paths, no filesystem.

### Reach the game itself

```js
// needs "kernel"
const { random, worlds, director, events } = ctx.kernel;
```

`ctx.kernel` exposes the live systems: the random stream a replay seed controls,
the world manager, the event director, the chronicle/region/politics state. It
is a small, typed surface on purpose — what a plugin can reach is a type you
can read, rather than an open door to the dependency container.

---

## The `ModContext` API

The `ctx` object passed to all hooks and `registerEventTypes` is your mod's **only interface to the game**. Mods cannot access the DI container, file system, or internal state directly — this is an intentional design constraint that keeps mods safe and forward-compatible.

| Property / Method | Description |
|-------------------|-------------|
| **`ctx.eventBus`** | Global typed event bus. Subscribe with `on(event, callback)`, emit with `emit(event, data)`. Built-in events: `player:updated`, `incident:executed`, `achievement:unlocked`. |
| **`ctx.configStore`** | Persistent key-value storage. Use `getSnapshot()` to read and `update(partial)` to write. Data survives restarts. |
| **`ctx.logger`** | Scoped logger with `info(msg)`, `warn(msg)`, `error(msg)`. Output appears in the terminal and the notification console. |
| **`ctx.getPlayer()`** | Returns the current `Player` instance. Always call this — don't cache the reference, as the Player may be replaced (e.g. when loading a save). |
| **`ctx.createEventClass(def)`** | Factory that creates an `Incident` subclass from `{ apply, getWeight? }`. Returns a constructor for use with `registry.register()`. |
| **`ctx.registerScreen(key, entry)`** | Registers a custom UI screen. `entry.component` is an Ink React component; pass `entry.parent` to place it under an existing screen, `entry.hide` controls menu visibility. |
| **`ctx.navigateTo(scene)`** | Programmatic navigation to any registered screen (by its `registerScreen` key). |
| **`ctx.registerAchievement(achievement)`** | Registers a custom achievement definition. |
| **`ctx.addCondition(id, ctor, schema)`** | Registers a reusable condition with a Zod validation schema. |
| **`ctx.addAlgorithm(name, factory)`** | Registers a custom event selection algorithm. |
| **`ctx.addFilter(id, filter)`** | Registers a custom incident filter for the selection pipeline. |
| **`ctx.addSetting(key, entry)`** | Adds a custom settings panel (Ink component) to the Settings screen. |
| **`ctx.addPressureAxis(def)`** | Adds a hidden-score axis to the world's pressure web. |
| **`ctx.addPressureRule(rule)`** | Adds a coupling rule between two hidden-score axes. |
| **`ctx.addLore(def)`** | Adds a codex entry (with an unlock condition). |
| **`ctx.addFateArc(def)`** | Adds a fate arc (condition → weight bias + buff). |
| **`ctx.addWorldEvent(def)`** | Adds a scripted world event at a given year. |
| **`ctx.addTrait(def)`** | Adds a starting trait. |

### Resource packs

Besides JSON events, a mod may ship any of these directories at its root — they are
merged with the built-ins (built-ins win on id clashes):

```
events/        items/     npcs/      levels/
achievements/  pressures/ language/
```

`pressures/` may contain `axes.json` and `rules.json`. Events support `worldGate`,
`pressureGate`/`pressureBias`, and `weatherGate`/`weatherBias`, so a mod's events can
key off the era, region, faction standing, hidden scores, or weather.

### Event Bus

```javascript
hooks: {
  onInit(ctx) {
    // Subscribe to built-in events
    ctx.eventBus.on("player:updated", (player) => {
      ctx.logger.info(`Player updated: ${player.playerName}`);
    });

    ctx.eventBus.on("incident:executed", (incident) => {
      if (incident.id === "some-event") {
        // React to a specific event being executed
      }
    });

    ctx.eventBus.on("achievement:unlocked", (achievement) => {
      ctx.logger.info(`Achievement unlocked: ${achievement.id}`);
    });
  },
},
```

### Config Store

```javascript
// Read
const snapshot = ctx.configStore.getSnapshot();
const myData = snapshot.myModData;

// Write (shallow-merged with existing config)
ctx.configStore.update({ myModData: { counter: 42 } });
```

---

## Translation Files

Place JSON files in `language/` named by locale code (e.g. `en_US.json`, `zh_CN.json`, `ja_JP.json`, `ru_RU.json`).

```json
{
  "events.myEvent": "Something extraordinary happened!",
  "events.myEvent.desc": "A mysterious force changes your fate.",
  "myMod.settingsTitle": "My Mod Settings",
  "achievements.myCustom": "Custom Champion",
  "achievements.myCustom.desc": "Unlocked by my custom mod."
}
```

Translation keys are namespaced — use a prefix unique to your mod to avoid collisions.

The game automatically merges mod translations with built-in ones. If a key exists in both, the mod's value takes precedence (last-loaded wins).

---

## Developing with TypeScript

Install `@baigao_h/terminal-live` as a dev dependency to get full type definitions:

```bash
cd ~/.mod_live/my-mod
npm install --save-dev typescript @baigao_h/terminal-live
```

Create a minimal `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "outDir": ".",
    "strict": true
  },
  "files": ["index.ts"]
}
```

Then write your plugin with full type safety:

```typescript
import type { ModPlugin, ModContext, Player, Incident } from "@baigao_h/terminal-live";

const plugin: ModPlugin = {
  id: "my-mod",

  registerEventTypes(registry, ctx: ModContext) {
    const MyEvent = ctx.createEventClass({
      apply(player: Player, self: Incident) {
        player.fortune += 100;
      },
    });
    registry.register("MyEvent", MyEvent);
  },

  hooks: {
    onInit(ctx: ModContext) {
      ctx.logger.info("Mod initialised!");
    },
    onPlayerUpdate(player: Player, ctx: ModContext) {
      if (player.health < 30) {
        ctx.logger.warn(`${player.playerName} is in critical condition!`);
      }
    },
    onIncidentTrigger(incident: Incident, player: Player, ctx: ModContext) {
      if (incident.id === "academic-stress" && player.angerValue > 80) {
        return false; // block
      }
    },
  },
};

export default plugin;
```

Compile:

```bash
npx tsc
```

Make sure `mod.json` points to the compiled output (e.g. `"main": "index.js"`).

---

## Sandbox & Hot-Reload

Your `index.js` is evaluated inside an isolated V8 context (`node:vm`), not
`require`d from Node. Inside it:

- `process`, `global`, `Buffer`, timers and every Node module are **undefined**.
- `require(...)` works only for `react`, `ink`, and `ink-cartridge`. Anything
  else throws.
- `module` / `exports` / `console` / `__filename` / `__dirname` are provided.

Everything else you need arrives through the `PluginContext` your hooks receive
— there is no need to import game internals.

`react`, `ink` and `ink-cartridge` resolve to the **game's own module
instances**, not copies: a plugin that rendered with its own React would produce
elements the game's reconciler rejects. (Ink is ESM-only, so a plain `require`
could not load it at all — the kernel injects it.)

> This is defence-in-depth for a single-player game, **not a security
> boundary**. The host has to hand a plugin live game objects, so a determined
> plugin escapes the sandbox anyway. Only install mods you trust — and see
> [Capabilities & Trust](#capabilities--trust) for the honest version of this.

### Hot-reload

Iterate without restarting. Open the in-game console (`P`) and run:

| Command | Effect |
|---------|--------|
| `mods` | List loaded mods and which are enabled |
| `mods-list` | List every installed mod folder |
| `mods-reload` | Re-read and reload all enabled mods now |
| `mods-watch` | Toggle the file watcher (edits auto-reload, debounced) |
| `mods-example` | Install the bundled example mod into `~/.mod_live/example_mod` |

With `mods-watch` on, saving any `*.js` or `*.json` under `~/.mod_live/` reloads
the plugins automatically. Resource JSON (events, items, language…) is read at
startup, so restart for those.

### Example mod

A complete, commented template ships at `resource/example-mod/`. Run
`mods-example` to copy it into your mod folder, then enable it in **Settings →
Mod Manager**. It demonstrates a custom event type, a hidden-score axis, a lore
entry, an `onYear` hook, and translation files.

---

## Enabling & Testing Your Mod

1. Place your mod directory in `~/.mod_live/`.
2. Launch the game: `terminal-live`.
3. Go to **Settings → Mod Manager**.
4. Find your mod in the list and press `Enter` to toggle it on.
5. Restart the game (or run `mods-reload` in the console `P`).

Enabled mods are persisted in `resource/config.json` under `enabledMods`. The Mod Manager also shows load errors — check the notification console (`P`) for diagnostics if your mod fails to load.

---

## Player Object Reference

The `Player` instance passed to hooks has these properties:

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `playerName` | `string` | — | The character's name. |
| `age` | `number` | 0–150 | Current age. Increments each round. |
| `health` | `number` | 0–100 | Health points. Reaching 0 may trigger game-over events. |
| `height` | `number` | 0.5–3.0 | Height in metres. |
| `weight` | `number` | 1–500 | Weight in kilograms. |
| `angerValue` | `number` | 0–100 | Anger emotion level. High values trigger anger-related status effects. |
| `excitationValue` | `number` | 0–100 | Excitement emotion level. |
| `depressionValue` | `number` | 0–100 | Depression emotion level. |
| `weakValue` | `number` | 0–100 | Weakness / fatigue level. |
| `fortune` | `number` | ≥ 0 | Fortune / luck stat. Modifies event outcomes. |

The dominant emotion (highest among anger, excitement, depression, weak) determines the active **status effect**, which applies periodic buffs or debuffs to health and other attributes.

All properties are mutable — mods can freely read and write them in hooks. Be mindful of balance.

---

## Best Practices

- **Namespace your IDs.** Use a mod-specific prefix for event IDs, translation keys, screen keys, and achievement IDs to avoid collisions with other mods and built-in content.
- **Don't cache `ctx.getPlayer()`.** The Player reference may change (e.g. save/load). Always call `getPlayer()` when you need the current instance.
- **Keep `apply` deterministic.** Event effects should derive only from `player` and `self.params`. Don't rely on external mutable state inside `apply`.
- **Use `ctx.configStore` for persistence.** It survives game restarts and is the only sanctioned way for mods to store data across sessions.
- **Check `onIncidentTrigger` carefully.** Returning `false` from one mod blocks the event for all mods. Use this power sparingly.
