import { SCREEN_SLOTS } from "../../core/plugin/ui.js";
import { makeScreenSlot } from "./ScreenSlot.js";
import MainMenu from "../MainMenu.js";
import WorldSelection from "../WorldSelection.js";
import WorldGame from "../WorldGame.js";
import Setting from "../Setting.js";
import useWorldGameScreen, {
  type GameScreenData,
} from "../../hooks/useWorldGameScreen.js";

/**
 * The game's replaceable screens.
 *
 * Navigation goes through these, never through the concrete components: the
 * screen tree is keyed by component identity, so a plugin can only take a
 * screen over if every navigator points at the stable slot wrapper. The raw
 * component is the fallback that renders when no plugin provides one.
 */
export const MainMenuScreen = makeScreenSlot(
  SCREEN_SLOTS.mainMenu,
  () => MainMenu,
);
export const WorldSelectionScreen = makeScreenSlot(
  SCREEN_SLOTS.worldSelection,
  () => WorldSelection,
);

/**
 * The in-game screen, with its view-model attached.
 *
 * A plugin taking this slot over gets `props.data` of this shape — the player,
 * the year, the actions on offer, the journal — so a replacement HUD renders
 * real state instead of an empty shell.
 */
export const WorldGameScreen = makeScreenSlot(
  SCREEN_SLOTS.worldGame,
  () => WorldGame,
  useWorldGameScreen as () => GameScreenData,
);

/** What {@link WorldGameScreen} hands a plugin as `props.data`. */
export type WorldGameViewModel = GameScreenData;

export const SettingScreen = makeScreenSlot(SCREEN_SLOTS.settings, () => Setting);
