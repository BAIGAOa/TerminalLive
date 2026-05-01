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

Key Action
S Start game
C Open settings
L Language selection
A Achievements
E Exit
Enter Next round (in game)
R View attributes
T View status
P Toggle notification console
Q Return to main menu

You can change every binding in the Key Recording menu under Settings.

## Configuration

All persistent data is stored under the resource/ directory inside the installation folder:

· config.json — language, initial player attributes, enabled mods.
· keys.json — key mappings.
· achievement/unlocked.json — achievement progress.

Player attributes (name, age, health, emotions, fortune) can be edited in-game through Player Config.

## Mods

Mods live in ~/.mod_live/<mod-name>/. Each mod can provide:

· An index.js entry that implements the ModPlugin interface (hooks, custom event types).
· JSON event definitions in an events/ folder.
· Language files in a language/ folder.
· A mod.json manifest (name, version, description, author).

Enable or disable mods in the Mod Manager (Settings > Mod Manager). Changes require a restart.

For developers, the mod API exposes:

· Lifecycle hooks (onInit, onPlayerUpdate, onIncidentTrigger, …)
· An EventBus for custom events.
· ConfigStore for persistence.
· A createEventClass helper to define new incident types.

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