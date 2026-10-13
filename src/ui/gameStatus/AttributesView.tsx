import React from "react";
import { Box, Text, useWindowSize } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import EffectRegistry from "../../world/effects/EffectRegistry.js";
import HealthSystem from "../../world/health/HealthSystem.js";
import { skillTier, averageCoreSkills } from "../../game/skillTier.js";
import { formatHeight, formatWeight } from "../../world/vitalsEngine.js";
import { useThemeColors } from "../../hooks/theme/ThematicCommunicator.js";
import { StatusScroll } from "./common.js";
import {
  burdenTone,
  cellsPerRow,
  gaugeTone,
  packColumns,
  pairItems,
  sheetColumnCount,
  type Tone,
} from "./sheetLayout.js";

/** One reading on the sheet: a label, a number, and how it should read. */
interface Cell {
  id: string;
  label: string;
  value: string;
  tone: Tone;
}

/** A titled group of readings, laid out a few to a line. */
interface Section {
  id: string;
  heading: string | null;
  rows: Cell[][];
}

/** Cells between columns. Matches `sheetLayout`'s gap. */
const COLUMN_GAP = 2;
/** The scrollbar `ScrollPanel` draws beside the sheet: a margin and a column. */
const SCROLLBAR_CHROME = 2;

type T = (key: string, params?: Record<string, string | number>) => string;

/**
 * The character sheet.
 *
 * Everything about *who the player is* lives here — the gauges, the mind, the
 * body, what is currently affecting them, and what they have caught. Those used
 * to be three separate panels you had to cycle between to answer one question;
 * consolidating them is the point, so the carousel is now only for the domains
 * that genuinely need their own page.
 *
 * No progress bars. A bar costs twenty cells to say one number, and the sheet's
 * job is to put as many readings in front of the player at once as it can.
 */
export default function AttributesView({
  player,
  t,
  height,
  width,
}: {
  player: Player;
  t: T;
  height?: number;
  /**
   * Cells the panel actually gives this view, from the game screen's layout.
   *
   * The terminal width is the wrong number here and was the bug: this renders
   * into one column of a row, so measuring the terminal made the sheet lay out
   * two columns of cards across a panel half that wide, and the excess was
   * clipped at the screen edge — the symptom being effects reading `暴怒 …`.
   * `useWindowSize` remains only as a fallback for a caller that passes none.
   */
  width?: number;
}) {
  const { columns } = useWindowSize();
  const colors = useThemeColors();
  const health = container.resolve(HealthSystem);
  const effects = container.resolve(EffectRegistry);

  const hstate = health.getState();
  const stat = (key: string, value: number, tone: Tone): Cell => ({
    id: key,
    label: t(`playerConfig.attr.${key}`),
    value: String(Math.round(value)),
    tone,
  });

  const colorOf = (tone: Tone): string => {
    switch (tone) {
      case "good":
        return colors.success;
      case "warn":
        return colors.warning;
      case "bad":
        return colors.danger;
      default:
        return colors.text;
    }
  };

  // ── the readings ───────────────────────────────────────────────
  const overview: Cell[] = [
    { id: "name", label: t("game.player"), value: player.playerName, tone: "neutral" },
    { id: "age", label: t("game.age"), value: String(Math.floor(player.age)), tone: "neutral" },
    { id: "money", label: t("player.money"), value: `$${Math.round(player.money)}`, tone: "neutral" },
    {
      id: "height",
      label: t("playerConfig.attr.height"),
      value: `${formatHeight(player.height)}m`,
      tone: "neutral",
    },
    {
      id: "weight",
      label: t("playerConfig.attr.weight"),
      value: `${formatWeight(player.weight)}kg`,
      tone: "neutral",
    },
    {
      id: "tier",
      label: t("game.skills.title"),
      value: t(skillTier(averageCoreSkills(player))),
      tone: "neutral",
    },
  ];

  const stats: Cell[] = [
    stat("health", player.health, gaugeTone(player.health)),
    stat("happiness", player.happiness, gaugeTone(player.happiness)),
    stat("intelligence", player.intelligence, gaugeTone(player.intelligence)),
    stat("social", player.social, gaugeTone(player.social)),
    stat("fitness", player.fitness, gaugeTone(player.fitness)),
    stat("reputation", player.reputation, gaugeTone(player.reputation)),
    stat("appearance", player.appearance, gaugeTone(player.appearance)),
  ];

  const mind: Cell[] = [
    stat("angerValue", player.angerValue, burdenTone(player.angerValue)),
    stat("depressionValue", player.depressionValue, burdenTone(player.depressionValue)),
    stat("excitationValue", player.excitationValue, burdenTone(player.excitationValue)),
    stat("weakValue", player.weakValue, burdenTone(player.weakValue)),
    {
      id: "trauma",
      label: t("health.trauma"),
      value: String(Math.round(hstate.trauma)),
      tone: burdenTone(hstate.trauma),
    },
    {
      id: "resilience",
      label: t("health.resilience"),
      value: String(Math.round(hstate.resilience)),
      tone: gaugeTone(hstate.resilience),
    },
    {
      id: "meaning",
      label: t("health.meaning"),
      value: String(Math.round(hstate.meaning)),
      tone: gaugeTone(hstate.meaning),
    },
    {
      id: "wellbeing",
      label: t("health.wellbeing"),
      value: String(health.wellbeing()),
      tone: gaugeTone(health.wellbeing()),
    },
  ];

  const active: Cell[] =
    player.activeEffects.length === 0
      ? [{ id: "none", label: t("game.effects.none"), value: "", tone: "neutral" }]
      : player.activeEffects.map((eff) => {
          const def = effects.get(eff.id);
          const buff = def?.kind !== "debuff";
          return {
            id: eff.id,
            label: `${buff ? "▲" : "▼"} ${def?.icon ?? ""} ${t(def?.labelKey ?? eff.id)}`,
            value: `${t("game.effects.turns", { n: eff.remaining })}${eff.stacks > 1 ? ` x${eff.stacks}` : ""}`,
            tone: buff ? "good" : "bad",
          };
        });

  const conditions: Cell[] = Object.entries(hstate.conditions).map(([id, c]) => ({
    id,
    label: t(`cond.${id}`),
    value: String(Math.round(c.severity)),
    tone: burdenTone(c.severity),
  }));
  const addictions: Cell[] = Object.entries(hstate.addictions).map(([id, a]) => ({
    id,
    label: t(`add.${id}`),
    value: String(Math.round(a.dependence)),
    tone: burdenTone(a.dependence),
  }));
  const ailing: Cell[] =
    conditions.length + addictions.length === 0
      ? [{ id: "none", label: t("health.none"), value: "", tone: "neutral" }]
      : [...conditions, ...addictions];

  // ── geometry, before the sections that depend on it ────────────
  // The width the panel gave us, less the scrollbar the viewport adds beside
  // the sheet when it overflows — reserving it always keeps the wrap stable
  // whether or not the bar is drawn.
  const availW = Math.max(12, (width ?? columns - 8) - SCROLLBAR_CHROME);
  const columnCount = sheetColumnCount(availW);
  const columnW = Math.max(
    12,
    Math.floor((availW - (columnCount - 1) * COLUMN_GAP) / columnCount),
  );
  // How many readings fit on a line *in that column*, which is not a constant:
  // a narrow column shows one per line rather than cutting both in half.
  const perRow = cellsPerRow(columnW);

  const sections: Section[] = [
    { id: "overview", heading: null, rows: pairItems(overview, perRow) },
    { id: "stats", heading: t("sheet.stats"), rows: pairItems(stats, perRow) },
    { id: "mind", heading: t("sheet.mind"), rows: pairItems(mind, perRow) },
    {
      id: "effects",
      heading: `${t("game.effects.title")} (${player.activeEffects.length})`,
      rows: pairItems(active, perRow),
    },
    {
      id: "health",
      heading: `${t("health.conditions")} (${conditions.length + addictions.length})`,
      rows: pairItems(ailing, perRow),
    },
  ];

  // A section costs its readings plus a blank line above it, and its heading.
  const blocks = sections.map((s) => ({
    id: s.id,
    rows: s.rows.length + (s.heading ? 2 : 0),
  }));
  const packed = packColumns(blocks, columnCount);

  const byId = new Map(sections.map((s) => [s.id, s]));
  const columnRows: React.ReactNode[][] = packed.map((ids) => {
    const out: React.ReactNode[] = [];
    ids.forEach((id, blockIndex) => {
      const section = byId.get(id);
      if (!section) return;
      if (blockIndex > 0) out.push(null);
      if (section.heading) {
        out.push(
          <Text bold color={colors.info} wrap="truncate">
            {section.heading}
          </Text>,
        );
      }
      for (const [i, row] of section.rows.entries()) {
        out.push(
          <CellRow
            key={`${id}-${i}`}
            cells={row}
            width={columnW}
            colorOf={colorOf}
          />,
        );
      }
    });
    return out;
  });

  // Zip the columns into rows of the sheet, so the scroll viewport sees one
  // entry per terminal row — which is what `ScrollPanel` requires.
  const depth = columnRows.reduce((max, col) => Math.max(max, col.length), 0);
  const lines: React.ReactNode[] = [];
  for (let r = 0; r < depth; r++) {
    lines.push(
      <Box flexDirection="row" key={r}>
        {columnRows.map((col, ci) => (
          <Box
            key={ci}
            width={columnW}
            marginRight={ci < columnCount - 1 ? COLUMN_GAP : 0}
          >
            {col[r] ?? null}
          </Box>
        ))}
      </Box>,
    );
  }

  return <StatusScroll height={height} lines={lines} />;
}

/** One line of a column: the readings side by side, each in its own cell. */
function CellRow({
  cells,
  width,
  colorOf,
}: {
  cells: Cell[];
  width: number;
  colorOf: (tone: Tone) => string;
}) {
  const cellW = Math.max(8, Math.floor(width / Math.max(1, cells.length)));
  return (
    <Box flexDirection="row">
      {cells.map((cell) => (
        <Box key={cell.id} width={cellW}>
          <Text wrap="truncate">
            <Text dimColor>{cell.label} </Text>
            <Text color={colorOf(cell.tone)} bold={cell.tone !== "neutral"}>
              {cell.value}
            </Text>
          </Text>
        </Box>
      ))}
    </Box>
  );
}
