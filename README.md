[中文](./README_ZH.md)
# Terminal Life

A text-based life simulator that runs in your terminal, built with Ink and React.

**Status:** Early development — game content is not yet complete, but core systems are functional.

## Motivation

This project was not created as a game for others to play. It is a personal experiment, built out of curiosity about terminal user interfaces, event-driven architecture, and dependency injection. The goal was to see how far a text-based interactive experience could go in a command-line environment, and to serve as a living codebase for exploring these ideas.

## Features

- **Life simulation** — progress through ages, experience random events and make choices.
- **Status effects** — dominant emotions apply periodic buffs or debuffs to health and other attributes.
- **Event engine** — weighted random events, age-range filtering, predecessor/block/once logic, post-event chains.
- **Mod support** — install mods into `~/.mod_live/`, each can add events, translations, and custom logic via a plugin API.
- **Achievements** — unlock conditions based on events, stat thresholds, or custom checks.
- **Fully keyboard driven** — key bindings are configurable via an in-game editor.
- **Multi-language** — English, Chinese, Japanese, Russian included; mods can supply additional languages.
- **Terminal UI** — built with [Ink](https://github.com/vadimdemedes/ink), supports 256 colours and resizing.

## Requirements

- **Node.js** >= 18
- A terminal with Unicode support and 256 colours (most modern terminals work)

## Installation

```bash
npm install -g @baigao_h/terminal-live
```

Usage

Run the game:

```bash
terminal-live
```

## Key bindings (default)

| Key    | Action                       |
|--------|------------------------------|
| S      | Start game                   |
| C      | Open settings                |
| L      | Language selection           |
| A      | Achievements                 |
| E      | Exit                         |
| Enter  | Next round (in game)         |
| R      | View attributes              |
| T      | View status                  |
| P      | Toggle notification console  |
| Q      | Return to main menu          |

You can change every binding in the Key Recording menu under Settings.

## Configuration

All persistent data is stored under the resource/ directory inside the installation folder:

· config.json — language, initial player attributes, enabled mods.
· keys.json — key mappings.
· achievement/unlocked.json — achievement progress.

Player attributes (name, age, health, emotions, fortune) can be edited in-game through Player Config.


## Mods

Mods are stored in `~/.mod_live/<mod-name>/`. Each mod can add events, translations, custom logic via plugins, and even custom UI screens.

### Directory Structure

```
~/.mod_live/
  my-mod/
    mod.json          # Mod manifest (required)
    index.js          # Plugin entry (optional)
    events/           # JSON event definitions (optional)
      custom.json
    language/         # Translation files (optional)
      en_US.json
      zh_CN.json
```

### Manifest (`mod.json`)

```json
{
  "name": "my-mod",
  "version": "1.0.0",
  "description": "An example mod",
  "main": "index.js",
  "author": "your-name"
}
```

### JSON Event Definitions

Place `.json` files in `events/`. Each file defines one event instance:

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

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Event class name (must be registered via `registerEventTypes` or built-in) |
| `id` | string | Unique event identifier |
| `nameKey` | string | Translation key for in-game log display |
| `rangeKey` | string[] | Age ranges where this event can trigger (e.g. `["5-12", "18-25"]`) |
| `weight` | number | Random weight (higher = more likely) |
| `once` | boolean \| string[] | `true` = trigger once globally. Array of ranges = trigger once per range |
| `predecessorEvent` | string \| null | This event only triggers if the predecessor has been triggered |
| `excludedIds` | string[] | Events that become blocked when this event triggers |
| `postEvent` | string \| object[] \| null | Event(s) scheduled after this one triggers |

### Plugin Entry (`index.js`)

The entry file exports a `ModPlugin` object. The game calls its methods at specific lifecycle points.

```javascript
module.exports = {
  id: "my-mod",

  // Register custom event types (optional)
  registerEventTypes(registry, ctx) {
    const MyEvent = ctx.createEventClass({
      apply(player, self) {
        player.fortune += 100;
        ctx.logger.info("Custom event triggered!");
      },
      getWeight(player) {
        return player.angerValue > 50 ? 0.6 : 0.1;
      },
    });
    registry.register("MyEvent", MyEvent);
  },

  // Lifecycle hooks (optional)
  hooks: {
    onInit(ctx) {
      ctx.logger.info("Mod loaded!");
      // Register a custom UI screen
      ctx.registerScreen({
        scene: "myModSettings",
        component: MySettingsComponent,
        nameKey: "myMod.settingsTitle",
        highlightId: "mySettings",
      });
    },

    onPlayerUpdate(player, ctx) {
      if (player.health < 30) {
        ctx.logger.warn("Low health!");
      }
    },

    onIncidentTrigger(incident, player, ctx) {
      // Return false to block an event
      if (incident.id === "academic-stress" && player.angerValue > 80) {
        return false;
      }
    },

    onIncidentExecuted(incident, player, ctx) {
      ctx.logger.info(`Event completed: ${incident.id}`);
    },
  },
};
```

### ModContext API

The `ctx` object provided to all hooks and callbacks:

| Property / Method | Description |
|-------------------|-------------|
| `ctx.eventBus` | Global event bus. Use `on(event, callback)` and `emit(event, data)`. Built-in events: `player:updated`, `incident:executed`, `achievement:unlocked`. |
| `ctx.configStore` | Persistent config storage. Use `getSnapshot()` and `update(partial)`. |
| `ctx.logger` | Logging: `info(msg)`, `warn(msg)`, `error(msg)`. Output appears in terminal stdout. |
| `ctx.getPlayer()` | Returns the current `Player` instance. |
| `ctx.createEventClass(def)` | Creates a dynamic `Incident` subclass from `{ apply, getWeight? }`. Returns a constructor to pass to `registry.register()`. |
| `ctx.registerScreen(entry)` | Registers a custom UI screen: `{ scene, component, nameKey, highlightId? }`. Scene ID is an arbitrary string. |
| `ctx.navigateTo(scene)` | Navigates to a registered scene (built-in: `"game"`, `"config"`, `"language"`, `"achievement"`, `"menu"`). |

### Lifecycle Hooks

| Hook | When Called | Use Case |
|------|-------------|----------|
| `onInit(ctx)` | After mod is loaded, before game starts | Initialization, event subscriptions, screen registration |
| `onPlayerCreated(player, ctx)` | After player object is created | Modify initial player state |
| `onPlayerUpdate(player, ctx)` | Every round, after player.update() | Per-turn side effects, stat monitoring |
| `onIncidentTrigger(incident, player, ctx)` | Before an incident is executed | Block events (return `false`), conditional logic |
| `onIncidentExecuted(incident, player, ctx)` | After an incident has executed | Logging, follow-up actions |

### Developing Mods with TypeScript

```bash
cd ~/.mod_live/my-mod
npm init -y
npm install --save-dev typescript @baigao_h/terminal-live
npx tsc --module commonjs --target es2022 --outDir . index.ts
```

Install `@baigao_h/terminal-live` as a dev dependency to get full type definitions for `ModPlugin`, `ModContext`, `Player`, `Incident`, etc.

### Enabling Mods

1. Place your mod directory in `~/.mod_live/`
2. Launch the game, go to **Settings → Mod Manager**
3. Toggle your mod on (press Enter)
4. Restart the game

Enabled mods are persisted in `resource/config.json` under `enabledMods`.

## Save System

Saves are stored in `~/.archive_live/` as timestamped JSON files (e.g. `2026-05-01-12-00.json`).

### Save Contents

Each save contains a complete snapshot of the game state:

- **Player attributes** — name, age, health, height, weight, emotions, fortune
- **Event history** — which events have been triggered or blocked
- **Achievement progress** — which achievements are unlocked
- **Game configuration** — language and enabled mods

### Saving

Open **Save Management** from the main menu. Press `S` to save the current game. The file is named automatically with the current timestamp.

### Loading

1. Open **Save Management** from the main menu
2. Use `↑` / `↓` to select a save
3. Press `Enter` to load

Loading writes the saved data back to the game's configuration files and exits. **Restart the game** to continue from the loaded state.

### Deleting

Select a save and press `D`. Confirm with `Enter` or cancel with `Esc`.

### Key bindings in Save Management

| Key | Action |
|-----|--------|
| `S` | Save current game |
| `Enter` | Load selected save |
| `D` | Delete selected save |
| `↑` / `↓` | Navigate saves |
| `Esc` | Return to main menu |

## Development

```bash
git clone https://github.com/BAIGAOa/TerminalLive
cd terminal-live
npm install
npm run dev      # build and run
npm run watch    # watch mode 
```

The game uses di-wise, a third-party dependency injection container library. New services should be decorated with @Scoped(Scope.Container), and they will be registered automatically.

## License

AGPL-3.0