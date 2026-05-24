# TerminalLive

<p align="center">
  <b>A text-based life simulator that runs in your terminal.</b><br>
  Built with <a href="https://github.com/vadimdemedes/ink">Ink</a> + React, powered by <a href="https://www.npmjs.com/package/@baigao_h/ink-kit">ink-router-kit</a>.
</p>

---

> **Status:** Early development — game content is not yet complete, but all core systems are functional and extensible.

---

## What is TerminalLive?

TerminalLive is a **terminal-based life simulation game** where you guide a character from birth through the ages, facing random events, making choices, and watching your stats shift under the influence of emotions, fortune, and circumstance.

It began as a personal experiment — an exploration of how far a text-based interactive experience could go inside a command-line environment. It is also a living playground for ideas around **event-driven architecture**, **dependency injection**, and **composable terminal UIs**.

---

## Features

- 🎲 **Event Engine** — weighted random events, age-range filtering, predecessor / block / once logic, and post-event chains.
- 🧩 **Mod Support** — install mods into `~/.mod_live/`; each can add events, translations, custom logic, and even custom UI screens.
- 🏆 **Achievements** — unlock conditions based on event history, stat thresholds, or custom checks.
- ⌨️ **Fully Keyboard-Driven** — every key binding is configurable through an in-game editor.
- 🌐 **Multi-Language** — English, 中文, 日本語, Русский included; mods can supply additional languages.
- 🎨 **Terminal UI** — 256-colour support, responsive resizing, built with [Ink](https://github.com/vadimdemedes/ink).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **UI Runtime** | [Ink](https://github.com/vadimdemedes/ink) (React for the terminal) |
| **Screen & Keyboard** | [`ink-router-kit`](https://www.npmjs.com/package/@baigao_h/ink-kit) — an independent framework for Ink screen management & layered keyboard handling |
| **Dependency Injection** | [`di-wise`](https://www.npmjs.com/package/di-wise) |
| **Schema Validation** | [`zod`](https://zod.dev) |
| **Language** | TypeScript |

### About ink-router-kit

[`ink-router-kit`](https://www.npmjs.com/package/@baigao_h/ink-kit) (`@baigao_h/ink-kit`) is a **standalone, MIT-licensed framework** developed by the same author. It solves two hard problems in complex Ink applications:

1. **Screen Management** — every React component is treated as a "screen", registered into a **screen tree**. Navigation uses `skip` / `back` / `gotoScreen` / `overlay` instead of hand-written conditional rendering. These primitives work both inside components (as hooks) and as **module-level imports**, so non-UI layers (game engines, state machines, etc.) can trigger screen transitions directly.

2. **Layered Keyboard Events** — instead of a single global `useInput` handler, key bindings are scoped **per screen layer**. Events bubble from top to bottom through the screen stack, with `blockedKey` (pass through), `stop` (halt propagation), and `globalKeys` (stack-independent shortcuts). A built-in **focus system** resolves key-binding conflicts within the same layer.

> ink-router-kit can be used independently of TerminalLive in any Ink-based project. See its [github page](https://github.com/BAIGAOa/ink-router-kit) for full documentation.

---

## Quick Start

### Requirements

- **Node.js** >= 18
- A terminal with Unicode support and 256 colours

### Install & Run

```bash
npm install -g @baigao_h/terminal-live
terminal-live
```

## Documentation

| Document | Contents |
|----------|----------|
| **[README_mod.md](./README_mod.md)** | Mod development guide — directory structure, manifest format, plugin API, lifecycle hooks, TypeScript support, and the full `ModContext` API reference. |
| **[ink-router-kit](https://github.com/BAIGAOa/ink-router-kit)** | Full API reference for the independent ink-router-kit framework (screen management, keyboard system, focus system, built-in components). |

---

## Configuration & Saves

- **Config files** live in `resource/` inside the installation directory (`config.json`, `keys.json`, `achievement/unlocked.json`).
- **Saves** are stored in `~/.archive_live/` as timestamped JSON snapshots. Each save captures your full game state — player attributes, event history, achievements, and configuration.
- Use **Save Management** from the main menu to save (`S`), load (`Enter`), or delete (`D`) saves.

---

## Development

```bash
git clone https://github.com/BAIGAOa/TerminalLive
cd TerminalLive
npm install
npm run dev      # build & run
npm run watch    # watch mode (auto-rebuild on changes)
npm test         # run tests
```

New services are registered automatically via `di-wise`: decorate them with `@Scoped(Scope.Container)` and they will be discovered by the DI container.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.  
See [LICENSE](./LICENSE) for the full text.

The independent framework [ink-router-kit](https://www.npmjs.com/package/@baigao_h/ink-kit) (`@baigao_h/ink-kit`) is licensed separately under the **MIT License**.

---

<p align="center">
  <sub>Built with curiosity — not as a product, but as an experiment.</sub>
</p>
