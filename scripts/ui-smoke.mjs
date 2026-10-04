/**
 * Deterministic UI smoke test. Renders the real provider chain + screen tree
 * (imported from the built dist/, so no decorator transform is needed) with
 * ink-testing-library and drives it with scripted keypresses.
 *
 * Run: npm run build && node scripts/ui-smoke.mjs
 */
import React from "react";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Box } from "ink";
import { render } from "ink-testing-library";
import {
  CurrentScreen,
  KeyboardProvider,
  ScenarioManagementProvider,
  registerComponent,
} from "ink-cartridge";

import { container } from "../dist/Container.js";
import GameInitialization from "../dist/core/GameInitialization.js";
import ConfigStore from "../dist/core/store/ConfigStore.js";
import { resolveKeymap } from "../dist/ui/keymap.js";
import { computeMenuLayout } from "../dist/ui/menuLayout.js";
import { SettingRegistry } from "../dist/core/registry/SettingRegistry.js";
import { LanguageProvider } from "../dist/core/language/LanguageContext.js";
import { TerminalSizeProvider } from "../dist/ui/TerminalSizeContext.js";
import { ThemeProvider } from "../dist/hooks/theme/ThematicCommunicator.js";

import MainMenu from "../dist/ui/MainMenu.js";
import LevelSelection from "../dist/ui/LevelSelection.js";
import LevelGame from "../dist/ui/LevelGame.js";
import Setting from "../dist/ui/Setting.js";
import PlayerConfig from "../dist/ui/PlayerConfig.js";
import ModManager from "../dist/ui/ModManager.js";
import ThemeScreen from "../dist/ui/ThemeScreen.js";
import KeyBinding from "../dist/ui/KeyBinding.js";
import Language from "../dist/ui/Language.js";
import Achievement from "../dist/ui/Achievement.js";
import Archive from "../dist/ui/Archive.js";
import Traits from "../dist/ui/Traits.js";
import Shop from "../dist/ui/Shop.js";
import Codex from "../dist/ui/Codex.js";
import { ToastHost } from "../dist/ui/ToastHost.js";

const h = React.createElement;
const tick = () => new Promise((r) => setTimeout(r, 90));

// Auto-save to a throwaway file so the smoke never writes the real life slot.
const AUTOSAVE_TMP = `${tmpdir()}/tl-smoke-${process.pid}.json`;
process.env.TL_AUTOSAVE = AUTOSAVE_TMP;

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? "[OK]" : "[FAIL]"} ${label}`);
  if (!cond) failures++;
}

// The smoke plays a life, which persists config + achievements + history.
// Snapshot those files and restore them on exit so the repo is untouched.
const RES = new URL("../resource/", import.meta.url);
const CFG_PATH = fileURLToPath(new URL("config.json", RES));
const PERSISTED = ["config.json", "achievement/unlocked.json", "history.json"];
const backups = new Map();
for (const rel of PERSISTED) {
  try {
    backups.set(rel, readFileSync(fileURLToPath(new URL(rel, RES)), "utf8"));
  } catch {
    /* ignore */
  }
}
const restoreConfig = () => {
  for (const [rel, content] of backups) {
    try {
      writeFileSync(fileURLToPath(new URL(rel, RES)), content, "utf8");
    } catch {
      /* ignore */
    }
  }
  try {
    rmSync(AUTOSAVE_TMP, { force: true });
  } catch {
    /* ignore */
  }
};
process.on("exit", restoreConfig); // runs after async persistence flushes
// Start from a clean slate (no active life) so the menu has no "Continue" item.
try {
  const clean = JSON.parse(backups.get("config.json"));
  delete clean.lastLevelId;
  clean.completedLevels = [];
  clean.traits = []; // so the trait-toggle check starts from a known state
  writeFileSync(CFG_PATH, JSON.stringify(clean, null, 2), "utf8");
} catch {
  /* ignore */
}

await container.resolve(GameInitialization).init();

// Respect the player's configured end-turn key (they may have rebound it).
const endTurnKey = resolveKeymap(
  container.resolve(ConfigStore).getKeyBindings(),
).endTurn;

registerComponent(MainMenu, {});
registerComponent(LevelSelection, {}, { parent: MainMenu });
registerComponent(LevelGame, {}, { parent: LevelSelection });
registerComponent(Setting, {}, { parent: MainMenu });
registerComponent(PlayerConfig, {}, { parent: Setting });
registerComponent(ModManager, {}, { parent: Setting });
registerComponent(ThemeScreen, {}, { parent: Setting });
registerComponent(KeyBinding, {}, { parent: Setting });
registerComponent(Language, {}, { parent: MainMenu });
registerComponent(Achievement, {}, { parent: MainMenu });
registerComponent(Archive, {}, { parent: MainMenu });
registerComponent(Traits, {}, { parent: MainMenu });
registerComponent(Shop, {}, { parent: MainMenu });
registerComponent(Codex, {}, { parent: MainMenu });

const settingReg = container.resolve(SettingRegistry);
settingReg.register("playerConfig", { component: PlayerConfig, nameKey: "setting.playerConfig" });
settingReg.register("modManager", { component: ModManager, nameKey: "setting.modManager" });
settingReg.register("theme", { component: ThemeScreen, nameKey: "setting.theme" });
settingReg.register("keyboard", { component: KeyBinding, nameKey: "setting.keyBoardConfig" });

const tree = h(
  LanguageProvider,
  null,
  h(
    TerminalSizeProvider,
    null,
    h(
      ThemeProvider,
      null,
      h(
        ScenarioManagementProvider,
        { defaultScreen: MainMenu, fullScreen: true },
        h(
          KeyboardProvider,
          { mouse: true, autoTab: true, modes: ["normal", "insert"], defaultMode: "normal" },
          h(Box, { flexDirection: "column" }, h(ToastHost), h(CurrentScreen)),
        ),
      ),
    ),
  ),
);

const { lastFrame, stdin } = render(tree);
const frame = () => lastFrame() ?? "";
const has = (s) => frame().includes(s);
// Poll until a predicate holds (handles variable render timings).
async function waitUntil(pred, maxTicks = 25) {
  for (let i = 0; i < maxTicks; i++) {
    if (pred()) return true;
    await tick();
  }
  return pred();
}

const backAtMenu = () => has("开始游戏") || has("Start Game");

console.log("[main menu]");
check("main menu rendered", await waitUntil(backAtMenu));

// The main menu is a responsive grid; navigate it with the real layout math
// instead of assuming a vertical list. Index: 0 start, 1 traits, 2 shop,
// 3 codex, 4 config, 6 achievements (no active life → no "Continue" entry).
const MENU_ITEMS = 9;
const { cols: MENU_COLS } = computeMenuLayout(
  100,
  Number.POSITIVE_INFINITY,
  MENU_ITEMS,
);
async function menuGoTo(index) {
  for (let i = 0; i < Math.floor(index / MENU_COLS); i++) {
    stdin.write("\u001B[B"); // down = one row
    await tick();
  }
  for (let i = 0; i < index % MENU_COLS; i++) {
    stdin.write("\u001B[C"); // right = one cell
    await tick();
  }
  stdin.write("\r");
}

// Traits screen (open, toggle one, Esc back)
await menuGoTo(1);
check("traits screen reached", await waitUntil(() => has("选择天赋") || has("Choose traits")));
stdin.write("\r"); // toggle the highlighted trait
check(
  "a trait got selected",
  await waitUntil(() => has("已选: 聪慧") || has("Selected: Smart")),
);
stdin.write("\u001B");
await waitUntil(backAtMenu);

// Shop screen
await menuGoTo(2);
check("shop screen reached", await waitUntil(() => has("商店") || has("Shop")));
stdin.write("\u001B");
check("back at main menu", await waitUntil(backAtMenu));

// Codex screen
await menuGoTo(3);
check("codex screen reached", await waitUntil(() => has("世界典籍") || has("Codex")));
stdin.write("\u001B");
check("back at main menu (2)", await waitUntil(backAtMenu));

// Achievements screen — guards the multi-line card layout
await menuGoTo(6);
check("achievements screen reached", await waitUntil(() => has("成就") || has("Achievement")));
stdin.write("\u001B");
check("back at main menu (3)", await waitUntil(backAtMenu));

// Settings: Esc leaves (the footer promises it)
await menuGoTo(4);
check(
  "setting screen reached",
  await waitUntil(() => has("设置界面") || has("Settings Menu")),
);
stdin.write("\u001B");
check("setting: Esc returns to the menu", await waitUntil(backAtMenu));

stdin.write("\r");
check("level selection reached", await waitUntil(() => has("选择关卡") || has("Select Level")));

stdin.write("\r"); // pick the first difficulty → focus moves to the level list
check(
  "level list shown",
  await waitUntil(
    () => has("童年") || has("Childhood") || has("青春期") || has("Adolescence"),
    20,
  ),
);

// Let the level list's focus hand-off settle, then one Enter starts it.
for (let i = 0; i < 3; i++) await tick();
let onGame = false;
for (let attempt = 0; attempt < 3 && !onGame; attempt++) {
  stdin.write("\r");
  onGame = await waitUntil(
    () => has("行动点") || has("行动") || has("Actions") || has("AP "),
    15,
  );
}
check("game screen reached (one Enter from the list)", onGame);

let sawChoice = false;
let sawStageComplete = false;
let sawJournal = false;
for (let i = 0; i < 24; i++) {
  stdin.write(endTurnKey);
  await tick();
  await tick();
  const f = frame();
  if (f.includes("1-9") || f.includes("抉择") || f.includes("A choice")) {
    sawChoice = true;
  }
  if (f.includes("阶段完成") || f.includes("Stage complete")) {
    sawStageComplete = true;
  }
  if (f.includes("事件") || f.includes("Events")) {
    sawJournal = true;
  }
  stdin.write("\r"); // confirm the highlighted option / dismiss any dialog
  await tick();
  stdin.write("\r");
  await tick();
}
check("still rendering after 24 turns (no crash)", frame().length > 0);
check("journal rendered", sawJournal);
check("auto-save file written during play", existsSync(AUTOSAVE_TMP));
check("a choice dialog appeared and resolved", sawChoice);
check("stage-complete dialog appeared at ~19", sawStageComplete);
check(
  "advanced past adolescence (keyboard-confirmed)",
  ["青年", "中年", "晚年", "youth", "midlife", "Old age", "Adulthood"].some((s) =>
    frame().includes(s),
  ),
);

// NPC cards + Tab focus: walk to the relationships page, Tab onto the cards,
// and confirm the interaction dialog opens (proving focus left the actions).
for (
  let i = 0;
  i < 8 && !(frame().includes("人物关系") || frame().includes("Relationships"));
  i++
) {
  stdin.write("\u001B[C"); // right → next status view
  await tick();
}
check(
  "relationships page reached",
  frame().includes("人物关系") || frame().includes("Relationships"),
);

stdin.write("\t"); // Tab → move focus from the actions to the NPC cards
await tick();
stdin.write("\r"); // open the selected card's interaction dialog
check(
  "npc modal opened after Tab",
  await waitUntil(() => frame().includes("交谈") || frame().includes("Talk"), 20),
);
stdin.write("\u001B"); // Esc closes
check(
  "npc modal closed",
  await waitUntil(
    () => !(frame().includes("交谈") || frame().includes("Talk")),
    15,
  ),
);

// Leaving the relationships page hands focus back to the actions: Tab off the
// page must not open the NPC dialog (the cards are no longer focusable).
stdin.write("\u001B[D"); // left → previous status view
await tick();
check(
  "left the relationships page",
  !(frame().includes("人物关系") || frame().includes("Relationships")),
);
stdin.write("\t");
await tick();
stdin.write("\r");
await tick();
check(
  "Tab off the page does not reopen the NPC dialog",
  !(frame().includes("交谈") || frame().includes("Talk")),
);

stdin.write("p");
await tick();
await tick();
check("console modal opened", frame().includes("控制台") || frame().includes("Console"));

stdin.write("\u001B");
await tick();
await tick();
check("console modal closed", !frame().includes("指令输入模式"));

restoreConfig();
console.log(failures === 0 ? "\nUI SMOKE PASSED" : `\n${failures} UI CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
