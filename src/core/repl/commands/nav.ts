import { gotoScreen } from "ink-cartridge";
import ReplRegistry from "../ReplRegistry.js";
import { ReplCommand } from "../types.js";
import Setting from "../../../ui/Setting.js";
import Language from "../../../ui/Language.js";
import AchievementScreen from "../../../ui/Achievement.js";
import Archive from "../../../ui/Archive.js";
import Traits from "../../../ui/Traits.js";
import Shop from "../../../ui/Shop.js";
import Codex from "../../../ui/Codex.js";

/** Commands that open the game's feature screens. */
export function registerNavCommands(reg: ReplRegistry): void {
  const register = (
    name: string,
    aliases: string[],
    screen: React.ComponentType<any>,
    enterKey: string,
  ) => {
    const cmd: ReplCommand = {
      name,
      aliases,
      summary: `repl.cmd.${name}`,
      usage: name,
      run: (ctx) => {
        ctx.print(ctx.t(enterKey), "dim");
        ctx.close?.();
        // The console can be opened from any screen, so jump across branches
        // rather than descending the tree (skip would reject non-children).
        gotoScreen(screen, {});
      },
    };
    reg.register(cmd);
  };

  register("settings", ["config", "set"], Setting, "repl.enter.settings");
  register("language", ["lang"], Language, "repl.enter.language");
  register("achievements", ["ach", "achievement"], AchievementScreen, "repl.enter.achievements");
  register("archive", ["saves", "save"], Archive, "repl.enter.archive");
  register("traits", ["trait"], Traits, "repl.enter.traits");
  register("shop", ["store"], Shop, "repl.enter.shop");
  register("codex", ["lore", "wiki"], Codex, "repl.enter.codex");
}
