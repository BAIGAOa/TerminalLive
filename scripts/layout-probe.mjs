/**
 * Layout probe: renders every screen at a range of terminal widths and reports
 * any line whose *display* width exceeds the terminal.
 *
 * `ink-testing-library` hardcodes `columns = 100`, which is why the UI smoke
 * test has never once looked at a narrow terminal. This drives ink directly
 * with a stdout whose size can be set, so overflow is measured rather than
 * eyeballed — and it fills the player's state first, because an empty life
 * renders mostly blank panels and hides exactly the overflow worth finding.
 *
 * Run: npm run build && node scripts/layout-probe.mjs
 *      node scripts/layout-probe.mjs 60 40     (explicit widths)
 */
import React from "react";
import { Box, render } from "ink";
import { EventEmitter } from "node:events";
import stringWidth from "string-width";
import {
  CurrentScreen,
  KeyboardProvider,
  ScenarioManagementProvider,
  registerComponent,
} from "ink-cartridge";

import { container } from "../dist/Container.js";
import GameInitialization from "../dist/core/GameInitialization.js";
import WorldManager from "../dist/worlds/WorldManager.js";
import HealthSystem from "../dist/world/health/HealthSystem.js";
import { SettingRegistry } from "../dist/core/registry/SettingRegistry.js";
import { LanguageProvider } from "../dist/core/language/LanguageContext.js";
import { ThemeProvider } from "../dist/hooks/theme/ThematicCommunicator.js";
import { ToastHost } from "../dist/ui/ToastHost.js";

import { MainMenuScreen as MainMenu, WorldSelectionScreen as WorldSelection, WorldGameScreen as WorldGame } from "../dist/ui/slots/screens.js";
import Setting from "../dist/ui/Setting.js";
import PlayerConfig from "../dist/ui/PlayerConfig.js";
import ModManager from "../dist/ui/ModManager.js";
import ThemeScreen from "../dist/ui/ThemeScreen.js";
import Language from "../dist/ui/Language.js";
import Achievement from "../dist/ui/Achievement.js";
import Archive from "../dist/ui/Archive.js";
import Traits from "../dist/ui/Traits.js";
import Shop from "../dist/ui/Shop.js";
import Codex from "../dist/ui/Codex.js";
import Lineage from "../dist/ui/Lineage.js";

const h = React.createElement;
const ROWS = 40;

const argv = process.argv.slice(2).map(Number).filter(Boolean);
const widths = argv.length > 0 ? argv : [100, 90, 80, 70, 60, 50, 40, 30];

/** A stdout whose size we choose, which is the whole point of this script. */
class SizedStdout extends EventEmitter {
  constructor(columns, rows) {
    super();
    this._columns = columns;
    this._rows = rows;
    this._last = "";
  }
  get columns() {
    return this._columns;
  }
  get rows() {
    return this._rows;
  }
  write = (frame) => {
    this._last = frame;
  };
  lastFrame = () => this._last;
  // Every `useWindowSize` subscribes to resize, and the game has far more of
  // them than Node's default warning threshold.
  setMaxListeners() {}
}

class FakeStdin extends EventEmitter {
  /**
   * Must be true, and this is not obvious: ink renders *nothing at all* to a
   * fake stdout when stdin is not a TTY. The tree mounts — its hooks subscribe
   * to the stream, so it looks alive — and then no frame is ever written.
   */
  isTTY = true;
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read() {
    return null;
  }
}

const tick = (ms = 140) => new Promise((r) => setTimeout(r, ms));

// ── boot, and make the player interesting ────────────────────────────
await container.resolve(GameInitialization).init();

const worlds = container.resolve(WorldManager);
worlds.start(worlds.getRootWorldIds()[0]);
const player = worlds.getPlayer();

// Three of everything: the state the report is about. An empty life renders
// empty panels, and an empty panel never overflows.
for (const id of ["fx_rage", "fx_focus", "fx_blessed", "fx_gloom"]) {
  player.addEffect(id, 3);
}
const health = container.resolve(HealthSystem);
health.diagnose("cond_depression", 40, 30);
health.diagnose("cond_hypertension", 30, 45);
health.useSubstance("add_alcohol", 25);
player.addItem("item_book", 3);
player.addItem("item_guitar", 1);
player.health = 38;
player.happiness = 30;
player.depressionValue = 62;
player.money = 12345;
player.careerId = "career_clerk";
player.careerRank = 2;
player.notify();

// ── register every screen so each can be the default ─────────────────
registerComponent(MainMenu, {});
registerComponent(WorldSelection, {}, { parent: MainMenu });
registerComponent(WorldGame, {}, { parent: WorldSelection });
registerComponent(Setting, {}, { parent: MainMenu });
for (const [screen, parent] of [
  [PlayerConfig, Setting],
  [ModManager, Setting],
  [ThemeScreen, Setting],
  [Language, MainMenu],
  [Achievement, MainMenu],
  [Archive, MainMenu],
  [Traits, MainMenu],
  [Shop, MainMenu],
  [Codex, MainMenu],
  [Lineage, MainMenu],
]) {
  registerComponent(screen, {}, { parent });
}

const settingReg = container.resolve(SettingRegistry);
settingReg.register("playerConfig", { component: PlayerConfig, nameKey: "setting.playerConfig" });
settingReg.register("modManager", { component: ModManager, nameKey: "setting.modManager" });
settingReg.register("theme", { component: ThemeScreen, nameKey: "setting.theme" });

const SCREENS = [
  ["main menu", MainMenu],
  ["world selection", WorldSelection],
  ["in-game", WorldGame],
  ["settings", Setting],
  ["player config", PlayerConfig],
  ["plugins", ModManager],
  ["theme", ThemeScreen],
  ["language", Language],
  ["achievements", Achievement],
  ["archive", Archive],
  ["traits", Traits],
  ["shop", Shop],
  ["codex", Codex],
  ["lineage", Lineage],
];

// ── sweep ────────────────────────────────────────────────────────────
let failures = 0;
for (const [name, Screen] of SCREENS) {
  for (const columns of widths) {
    const stdout = new SizedStdout(columns, ROWS);
    const stderr = new SizedStdout(columns, ROWS);
    const stdin = new FakeStdin();

    const tree = h(
      LanguageProvider,
      null,
      h(
        ThemeProvider,
        null,
        h(
          ScenarioManagementProvider,
          { defaultScreen: Screen, fullScreen: true },
          h(
            KeyboardProvider,
            { mouse: false, autoTab: true, modes: ["normal", "insert"], defaultMode: "normal" },
            h(Box, { flexDirection: "column" }, h(ToastHost), h(CurrentScreen)),
          ),
        ),
      ),
    );

    let unmount = () => {};
    try {
      ({ unmount } = render(tree, {
        stdout,
        stdin,
        stderr,
        // `debug` is what makes ink write a whole frame instead of a diff; on a
        // fake stdout the incremental path writes nothing at all.
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
      }));
    } catch (err) {
      console.log(`  [ERR]   ${name} @ ${columns} — render threw: ${err?.message ?? err}`);
      failures++;
      continue;
    }
    await tick();

    const frame = stdout.lastFrame() ?? "";
    if (frame.trim().length === 0) {
      console.log(`  [EMPTY] ${name} @ ${columns} — nothing rendered`);
      failures++;
      unmount();
      continue;
    }

    const over = frame
      .split("\n")
      .map((line, i) => ({ i, w: stringWidth(line), line: line.replace(/\x1b\[[0-9;]*m/g, "") }))
      .filter((l) => l.w > columns);

    if (over.length > 0) {
      failures += over.length;
      console.log(`  [OVER]  ${name} @ ${columns} — ${over.length} line(s) too wide`);
      for (const o of over.slice(0, 4)) {
        console.log(`          line ${o.i}: ${o.w} cells (${o.w - columns} over)`);
        console.log(`            |${o.line}|`);
      }
    }

    unmount();
    await tick(40);
  }
}

if (failures === 0) {
  console.log(
    `\nno overflow in ${SCREENS.length} screens × ${widths.length} widths`,
  );
} else {
  console.log(`\n${failures} problem(s) total`);
}
process.exit(failures === 0 ? 0 : 1);
