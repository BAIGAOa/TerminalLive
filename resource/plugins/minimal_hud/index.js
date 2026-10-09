// Minimal HUD — a shipped plugin that replaces the in-game screen.
//
// It is the worked example of a plugin taking a screen over, and it exercises
// the parts of the API a *shipped* plugin is the first to use: a JS entry
// evaluated from `resource/plugins/` (not `~/.mod_live/`), an opt-in manifest
// (`defaultEnabled: false`), and a screen slot fed the game's own view-model.
//
// The screen it replaces is `screen.world-game`. Whatever renders it receives
// `props.data` — the view-model the game measured for that screen — so a
// replacement lays out real state instead of an empty shell.

const React = require("react");
const { Box, Text, useWindowSize } = require("ink");
const { useKeyboard } = require("ink-cartridge");

/** Set by onInit so the component can read config/kernel without a container. */
let ctx = null;

module.exports = {
  id: "minimal_hud",

  hooks: {
    onInit(context) {
      ctx = context;
      context.overrideScreen("screen.world-game", MinimalHud);
      context.logger.info("极简界面已接管游戏主画面");
    },
  },
};

/** Action points, one line: the numbers a player actually plays by. */
const STAT_ROWS = [
  { key: "minimal_hud.stat.health", field: "health", color: "green" },
  { key: "minimal_hud.stat.happiness", field: "happiness", color: "yellow" },
  { key: "minimal_hud.stat.money", field: "money", color: "cyan" },
];

function MinimalHud({ data }) {
  const t = ctx.t;
  const { columns } = useWindowSize();
  const width = Math.max(34, Math.min(columns - 2, 72));

  const [index, setIndex] = React.useState(0);
  const actions = data.actionViews;
  const current = actions[Math.min(index, Math.max(0, actions.length - 1))];

  const { boundKeyboard } = useKeyboard();
  React.useEffect(() => {
    const move = (step) =>
      setIndex((i) => {
        if (actions.length === 0) return 0;
        return (i + step + actions.length) % actions.length;
      });
    const unbinds = [
      boundKeyboard(["up"], () => move(-1)),
      boundKeyboard(["down"], () => move(1)),
      boundKeyboard(["return"], () => {
        if (current && current.available) data.performAction(current.def.id);
      }),
    ];
    // End the year on whatever key the player bound — read from the kernel
    // rather than hard-coded, so rebinding still works with this screen up.
    const bound = ctx.kernel.config.getKeyBindings();
    const endKey = bound.endTurn || "e";
    unbinds.push(
      boundKeyboard(endKey.length === 1 ? [endKey, endKey.toUpperCase()] : [endKey], () =>
        data.endTurn(),
      ),
    );
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, actions.length, current, data]);

  const player = data.player;
  const year = ctx.kernel.chronicle.year;
  /** Money and stats arrive as floats; a missing one must not print "NaN". */
  const num = (value) => (Number.isFinite(value) ? Math.round(value) : 0);

  return React.createElement(
    Box,
    {
      flexDirection: "column",
      width,
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 1,
    },
    React.createElement(
      Box,
      { justifyContent: "space-between" },
      React.createElement(
        Text,
        { bold: true, color: "cyanBright", wrap: "truncate" },
        // The world's own (translated) name, not its id: a player reads
        // "黄金时代", not "golden_age".
        `${Math.floor(player.age)}${t("minimal_hud.years")} · ${data.levelName} · ${year}`,
      ),
      React.createElement(Text, { color: "yellow" },
        `${t("game.actions.apShort")} ${data.actionPoints}/${data.maxActionPoints}`),
    ),
    // One line for the numbers: three `space-between` labels wrap as soon as
    // the translations are longer than the English ones.
    React.createElement(Text, { wrap: "truncate" },
      STAT_ROWS.map((row) =>
        `${t(row.key)} ${num(player[row.field])}`,
      ).join("  ·  "),
    ),
    React.createElement(Text, { dimColor: true }, "─".repeat(Math.max(10, width - 4))),
    actions.length === 0
      ? React.createElement(Text, { dimColor: true }, t("game.actions.none"))
      : React.createElement(
          Box,
          { flexDirection: "column" },
          actions.map((action, i) =>
            React.createElement(
              Box,
              { key: action.def.id, justifyContent: "space-between" },
              React.createElement(
                Text,
                {
                  color: !action.available
                    ? "gray"
                    : i === index
                      ? "greenBright"
                      : "white",
                  bold: i === index,
                },
                `${i === index ? "❯ " : "  "}${action.def.icon || "•"} ${t(action.def.labelKey)}`,
              ),
              React.createElement(Text, { dimColor: true },
                `${t("game.actions.apShort")}${action.def.apCost || 1}`),
            ),
          ),
        ),
    data.logs.length
      ? React.createElement(Text, { dimColor: true, wrap: "truncate" },
          `· ${data.logs[0].eventName}`)
      : null,
  );
}
