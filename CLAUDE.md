# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core rule: pure logic must be decoupled from the UI layer

**When writing code, keep pure logic strictly separated from the UI layer.** Our testing
principle is that **UI correctness is never tested** — only pure logic is tested.

- Any non-trivial computation embedded in a React/Ink component (layout math, fitting,
  status derivation, formatting, scoring, filtering) must be **extracted into a plain,
  React-free module** and unit-tested there. Components import and call it; they do not
  own the logic.
- Models to follow: `src/ui/menuLayout.ts` (`computeMenuLayout` / `fitPanelSections`, pure
  functions) tested by `src/__tests__/kit/menuLayout.test.ts`, and `src/game/score.ts` /
  `src/game/lifeReview.ts` (pure game logic, no React/DI).
- Do **not** add UI tests, do **not** run UI test suites, and do **not** propose "run the
  app and eyeball it" verification steps. If logic is trapped in a component, refactor it
  out first, then test the extracted module.
- This applies to logic *and* the data it needs: a component should receive plain values
  (or a pure view-model) from a hook/service rather than computing them inline, so the
  computation stays testable without rendering.

## Commands

```bash
npm run dev          # build (tsc) then run via bun
npm run watch        # tsc --watch, rebuilds dist/
npm run build        # tsc --locale zh-CN → dist/
npm run start        # run the built dist/main.js (bun)
npm run runtsc       # run src/main.tsx directly with tsx (no build)

npm test             # vitest run — unit tests for pure logic / engine
npx vitest run src/__tests__/game/lifeReview.test.ts   # single test file
npx vitest run -t "buildLifeReview"                    # single test by name
npx tsc --noEmit     # cheap typecheck; preferred over heavy suites during iteration

npm run test:engine  # build + headless full-life simulation (dist/dev/validate.js)
node scripts/plugins-probe.mjs  # build + boot, then list what the plugin kernel mounted
npm run test:ui      # build + scripts/ui-smoke.mjs (drives the screen tree via ink-testing-library)
npm run balance      # build + dist/dev/montecarlo.js — balance simulation
```

**Test cadence:** do **not** run `test:ui`, `test:engine`, or a full `vitest run` after
every change — they are slow. Implement, run `npx tsc --noEmit` if you need a cheap check,
then summarize. Run the heavy suites only when the user asks or a regression would be
costly. `npm test` is the default unit-test entry point.

## Architecture

**Runtime:** Ink + React for the TUI; [`ink-cartridge`](https://github.com/BAIGAOa/ink-cartridge)
provides the screen tree, floating/modal layers, layered keyboard engine, focus system and
mouse regions. `ink` must stay **>= 8.0.0** — ink 8 is what requires React >= 19.3, and
mouse regions rely on `measureElement()` returning `x`/`y`, which older ink omits
(options silently become unhittable on 7.0.x).

**Dependency injection:** a tiny hand-rolled lazy-singleton container in `src/Container.ts`
(`container.resolve(Ctor)` / `inject(Ctor)`). There are **no decorators and no `di-wise`** —
services are plain classes with no-arg constructors that pull dependencies via `inject()`.
This is deliberate: it keeps the source transformable by vitest/Vite so every module is
directly unit-testable.

**Entry & screen tree:** `src/main.tsx` is the only composition root. It resolves
`GameInitialization` (which boots config, player, content, mods, saves, themes), then
registers every screen into ink-cartridge's tree via `registerComponent(...)`. Navigation
is `gotoScreen` / `skip` / `back`. Adding a screen means registering it here and, if it's a
Settings sub-page, also into `SettingRegistry`.

**Plugin architecture (microkernel):** everything the game does beyond its core is a
plugin, and so is every mod — one manifest schema, one capability model, one context
API. Three sources differ only in where they are found: the game's own plugins
(`src/plugins/`, TypeScript), shipped plugins (`resource/plugins/`, JSON + optional
`index.js`), and user mods (`~/.mod_live/`, JS).
- `src/core/plugin/` is the kernel: `PluginHost` (discover → plan → evaluate → mount →
  dispatch → unload), `manifest.ts` (unified schema), `discovery.ts` (both roots),
  `sources.ts` (enablement + ordering), `loadOrder.ts`, `trust.ts` (sandbox vs full
  evaluation), `evaluate.ts`, `storage.ts` (per-plugin persistence), `services.ts`
  (plugins extending plugins), `ui.ts` (`UiSlotRegistry`), `kernel.ts` (the typed
  system surface plugins get as `ctx.kernel`).
- Plugins **replace** as well as add: `overrideScreen(slot, …)` through `ui/slots/`,
  `addStatusView`/`addCommand`/`addSetting` upsert over the built-in of the same id.
- Adding a feature means adding `src/plugins/<id>/index.ts` and an entry in
  `src/plugins/index.ts` — not editing the kernel. The game's own plugins so far:
  `core.status-views` (the in-game panels), `core.console-commands` (the `P`
  console toolkit), `core.keybindings` (the Settings → Key bindings page, which
  also publishes the `ui.keyactions` service other plugins add hotkeys through).
- `core/mod/` keeps the mod-shaped pieces: `ModMonitor` (discovery paths),
  `capabilities.ts`, `EventTypes`, `eventValidation`, `ModWatcher`.

**Layering (logic → UI):**
- `src/core/` — infrastructure: `GameInitialization`, `Game` (the gameplay facade),
  `TypedEventBus`, registries, random, archive/save, theme, repl, stores.
- `src/content/` — content loaders that populate registries from `resource/*.json` and mods
  (`Actions`, `Effects`, `Traits`, `Weather`, `Conditions`, `GameStatus`, `Arcs`, …).
  World content/manifests are loaded by `src/worlds/`.
- `src/world/` — gameplay systems & state: `Player`, `stats`, `requirements`, `choices`,
  and the `chronicle/`, `relationships/`, `careers/`, `economy/`, `health/`, `politics/`,
  `regions/`, `chains/`, `narrative/`, `pressures/`, `items/`, `weather/`, `lineage/` systems.
- `src/event/` — the event engine: `EventCenter`, `EventDirector`, weighted algorithm,
  `filters/` (predecessor/once/blocked), `ChainTracker`, `PostEventScheduler`.
- `src/worlds/` — `WorldManager` drives worlds/lives: per-world content loading
  (`WorldContentLoader`), manifests (`WorldManifestLoader`), event loading per world,
  world conditions, and progression (`worldProgression`, `worldChain`).
- `src/hooks/` — React hooks that bridge services/stores to screens (view-model layer).
- `src/ui/` — screens (`*.tsx`), `ui/kit/` reusable components, `ui/layers/` modal & console
  layer bus (`modalBus`, `consoleLayer`), and pure helpers like `menuLayout.ts`, `keymap.ts`.

**Registries:** most collections extend `BaseRegistry<T>` (`src/core/registry/BaseRegistry.ts`)
— a `Map` with `register` (throws on duplicate key), `get` (throws on missing), `getAll`,
`filter`. Content is registered at boot, not imported ad hoc by consumers.

**Randomness:** all randomness goes through `src/core/random/` — `RandomService` /
`SeededRandom` / `RandomJournal` — so runs are reproducible and replayable. Use it instead
of `Math.random()`.

**Mods & saves:** mods live in `~/.mod_live/`, are capability-gated by their manifest, and
hot-reload via the `mods-watch` console command or `R` in Settings → Plugins. A mod runs
sandboxed (`node:vm`) unless it asks for `"trust": "full"` in its manifest or the player
grants it (`trustedPlugins` in `config.json`) — the sandbox is defence-in-depth, not a
security boundary, and the code says so. Plugin state lives in `~/.plugin_data/<id>/`;
saves in `~/.archive_live/`; `resource/` holds `config.json`, languages and achievements.
See `README_mod.md` for the plugin authoring guide.

**Module resolution:** `tsconfig` uses Node16 — **relative imports must carry the `.js`
extension** (`import Game from "./Game.js"`), even for `.ts`/`.tsx` sources. `src/__tests__`
is excluded from the build and imports `src/` with the same `.js`-suffixed paths.

**i18n:** user-facing strings go through the language system (`src/core/language`,
`resource/language/{en_US,ja_JP,ru_RU,zh_CN}.json`); some source comments are in Chinese.

## CI

`.github/workflows/ci.yml` runs `npm ci && npm run build && npm test` on Node 22/24 for
pushes/PRs to `main`. Publishing to npm happens on `v*` tags (idempotent per version).
