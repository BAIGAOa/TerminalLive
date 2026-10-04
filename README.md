# TerminalLive

<p align="center">
  <b>A text-based life simulator that runs in your terminal.</b><br>
  Built with <a href="https://github.com/vadimdemedes/ink">Ink</a> + React, powered by <a href="https://www.npmjs.com/package/ink-cartridge">ink-cartridge</a>.
</p>

---

> **Status:** Playable end-to-end. Guide a character from childhood to old age through
> action-point years, branching events, skills, items and relationships.

---

## What is TerminalLive?

TerminalLive is a **terminal-based life simulation game**. Each year you spend **action
points** on choices like studying, working, exercising or socialising, then the world
responds — random events fire, many of them pausing for a **branching decision** that
ripples through your stats, money, skills, possessions and the people around you.

It is also a showcase for [`ink-cartridge`](https://github.com/BAIGAOa/ink-cartridge):
screen trees, floating layers, **modal dialogs**, a layered keyboard engine, a focus
system and full **mouse** support (hover, click, wheel and drag) are all exercised by the
game itself.

---

## Features

- 🎯 **Action-point turns** — every year you get action points to spend on age-appropriate
  actions (play, study, exercise, socialise, work, invest, meditate, …).
- 🔀 **Branching events** — events offer 2–4 choices with different outcomes; pick with the
  number keys, the arrow keys, or the **mouse**. Choices can gate on your stats.
- 📈 **Skills & growth** — intelligence, social and fitness grow into tiers; happiness and
  health track your wellbeing.
- ⏳ **Timed status effects** — buffs and debuffs (focus, energy, sickness, gloom, …) tick
  down year by year; high anger/excitement/depression spawn their own effects.
- 🎒 **Inventory & items** — earn books, medicine, coffee, keepsakes and more; use them from
  the inventory panel.
- 💞 **Relationships** — build affinity with family, friends, a partner and a child; your
  bonds shape the life you lead.
- 🪜 **Ages** — childhood → adolescence → youth → midlife → old age, each with its own
  goals, events and content.
- 🌍 **Chronicle of Fate** — a living world you are embedded in: it passes through **eras**
  (Dawn → Iron → Steam → Electric → Stars), you are born into a **region**, you earn or
  lose **faction standing** (Scholars · Merchants · Wardens · Shadows), every choice writes
  to a **karma** ledger (benevolence / ambition / wisdom / rebellion), and matching states
  awaken **fate arcs** that bias your future events. Events can be gated on the world.
- 📖 **Codex** — world lore unlocks as the world and your karma change; read it from the
  main menu.
- 🧑🤝🧑 **People, not bar charts** — each NPC is a **card** you can select and **interact**
  with (talk · gift · help · confide · quarrel · reconcile · go out), and they **act on their
  own**: quiet favours and pleas, and now-and-then an **offer** that pops a real choice
  ("@friend wants a weekend trip — go?"). The relationship cards share a focus group with the
  action panel, so **Tab** switches between them, and leaving the page returns focus to the
  actions.
- 🎴 **Traits & perks** — pick up to two birth traits; a perks panel tracks the milestones
  your stats and bonds have earned.
- 🏪 **Shop** — spend your money on items.
- 🏆 **Achievements** — unlocked via events, stat thresholds or milestones (marriage,
  parenthood, home ownership, …).
- 💾 **Auto-save & resume** — the current life (player, inventory, relationships, world,
  weather, history) is saved continuously; quit any time and **Continue** from the main
  menu later. A finished life clears the slot. Named save slots are also available.
- 🎲 **Event engine** — weighted random events, age-range and world gating, predecessor /
  block / once logic, delayed post-event chains and mod-defined event types.
- 🧩 **Mod support** — install mods into `~/.mod_live/` to add events, levels, items, NPCs,
  translations, achievements and UI screens. Mods run **sandboxed** (`node:vm`, restricted
  `require`) and support **hot-reload** via the `mods-watch` console command.
- 🌐 **Multi-language** — English, 中文, 日本語, Русский included.
- 🖱 **Mouse-driven UI** — hover to focus, click to select, wheel to scroll, drag modal
  windows; the keyboard always works too, and focus is shared between them.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **UI Runtime** | [Ink](https://github.com/vadimdemedes/ink) (React for the terminal) |
| **Screen, Layers & Input** | [`ink-cartridge`](https://www.npmjs.com/package/ink-cartridge) — screen tree, floating/modal layers, the layered keyboard engine, focus system and mouse regions |
| **Dependency Injection** | a tiny built-in lazy singleton container (`src/Container.ts`) — no decorators, so the source runs unchanged under `tsc`, `tsx` and vitest |
| **Schema Validation** | [`zod`](https://zod.dev) |
| **Language** | TypeScript |

### About ink-cartridge

[`ink-cartridge`](https://www.npmjs.com/package/ink-cartridge) is a standalone, MIT-licensed
framework by the same author. It enhances Ink with the primitives a complex TUI needs:

1. **Screen tree** — every component can be a screen, registered into a tree and navigated
   with `skip` / `back` / `gotoScreen`, from components *or* from plain module code.
2. **Floating & modal layers** — `openLayer` / `applyElement` for persistent panels and
   toasts, `openModalLayer` / `applyElementToModalLayer` for dialogs that own the keyboard
   and mouse while open. Layers can be raised, restored, activated and deactivated.
3. **Layered keyboard engine** — a 9-stage pipeline resolves conflicts between modal
   layers, regular layers, global keys, sequences and the screen stack. Bindings are scoped
   to focus targets so several controls can coexist; modes, conditions, composition and
   custom processors are all supported.
4. **Mouse regions** — hover, click, wheel and drag, with automatic mouse↔keyboard focus
   convergence and hit priority matching the keyboard.

> ink-cartridge is useful independently of TerminalLive. See its
> [github page](https://github.com/BAIGAOa/ink-cartridge) for the full API.

---

## Quick Start

### Requirements

- **Node.js** >= 22
- **`ink` >= 7.1.1** — pinned in `package.json`; mouse regions rely on
  `measureElement()` returning `x`/`y`, which older ink versions omit (regions
  silently become unhittable on ink <= 7.0.x).
- A terminal with Unicode support, 256 colours and mouse reporting
  (mouse needs a real TTY; without one the game falls back to keyboard-only)

### Install & Run

```bash
npm install -g @baigao_h/terminal-live
terminal-live
```

---

## Gameplay & Controls

Spend your action points on the left, watch your status on the right, and end the year to
age up and let events unfold. Some events pause for a decision.

| Key | Action |
|-----|--------|
| `↑` `↓` `⏎` / click | Choose an action / event option |
| `Tab` / click | Move focus between panels |
| `←` `→` | Cycle the status view (attributes, skills, effects, inventory, relationships) |
| `E` | End the current year |
| `P` | Toggle the developer console |
| `?` | Help |
| `Q` | Back to the main menu |

Mouse: hover a list to focus it, click to select, scroll the journal with the wheel, and
drag modal windows (choices, console, help) to move them. Every key binding above is
re-bindable from **Settings → Key bindings**.

---

## Documentation

| Document | Contents |
|----------|----------|
| **[README_mod.md](./README_mod.md)** | Mod development guide — directory structure, manifest format, plugin API, lifecycle hooks, and the event/choice/item schema. |
| **[ink-cartridge](https://github.com/BAIGAOa/ink-cartridge)** | Full API reference for the framework (screens, layers, keyboard, focus, mouse). |

---

## Configuration & Saves

- **Config files** live in `resource/` (`config.json`, `achievement/unlocked.json`).
- **Saves** are stored in `~/.archive_live/` as timestamped snapshots capturing the full game
  state — player stats, skills, effects, inventory, relationships, flags, event history and
  achievements. Use **Save Management** from the main menu.

---

## Development

```bash
git clone https://github.com/BAIGAOa/TerminalLive
cd TerminalLive
npm install
npm run dev          # build & run
npm run watch        # watch mode (auto-rebuild on changes)
npm test             # unit tests (UI kit, filters)
npm run test:engine  # build + headless engine/content integration check
```

New services are registered automatically via `di-wise`: decorate them with
`@Scoped(Scope.Container)` and the DI container discovers them.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
See [LICENSE](./LICENSE) for the full text.

The independent framework [`ink-cartridge`](https://www.npmjs.com/package/ink-cartridge)
is licensed separately under the **MIT License**.
