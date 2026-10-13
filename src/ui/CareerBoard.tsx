import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useWindowSize } from "ink";
import { useKeyboard, useMouseRegion } from "ink-cartridge";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import WorldManager from "../worlds/WorldManager.js";
import CareerSystem from "../world/careers/CareerSystem.js";
import type Player from "../world/Player.js";
import ConfigStore from "../core/store/ConfigStore.js";
import CareerInterview from "./CareerInterview.js";
import {
  rankViews,
  summarizeBoard,
  type CareerCard,
  type CareerGateStatus,
} from "../world/careers/careerBoard.js";
import type { CareerDefinition } from "../world/careers/CareerDefinition.js";
import { deltaEntries, type StatDelta } from "../world/stats.js";
import { MenuList, ModalFrame, clampHeight, clampWidth } from "./kit/index.js";
import { dismissModal } from "./layers/modalBus.js";
import { GJ_MODAL_ID } from "./layers/layerIds.js";
import { cardHeight, computeCareerGrid, type CardSize } from "./careerGrid.js";

/**
 * The career board: the `g j` modal.
 *
 * A grid of job cards you walk with the arrow keys (or the mouse), Enter to
 * open one, Enter again to take the job. Every eligibility rule is decided by
 * the pure `careerBoard` module — this file only draws it, which is what keeps
 * the hiring logic testable without a terminal.
 *
 * The detail pane is two columns rather than one long scroll: what the job is
 * and whether you qualify on the left, the ladder you are buying into on the
 * right. In a terminal, height is the scarce resource.
 *
 * The board adapts to that scarcity rather than fighting it: the cards shed
 * their borders, then their extra lines, before the board sheds jobs — and what
 * still does not fit scrolls, because `MenuList` windows the grid by row.
 */

/** Rows the frame spends on borders, padding and the title block. */
const MODAL_CHROME = 6;
/** The summary line above the grid, with its margin. */
const BOARD_HEADER = 2;
/** The hint lines below the grid, with their margin. */
const BOARD_FOOTER = 3;
/** Below these, the chrome rows are better spent on cards. */
const HEADER_MIN_ROWS = 9;
const FOOTER_MIN_ROWS = 7;

export default function CareerBoard() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { columns, rows } = useWindowSize();

  const careers = container.resolve(CareerSystem);
  const player = container.resolve(WorldManager).getPlayer();

  // Re-derive the board whenever the player moves (money and stats are gates).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = player.subscribe(() => setTick((n) => n + 1));
    return () => {
      unsubscribe();
    };
  }, [player]);

  const cards = useMemo(
    () => careers.getBoard(player),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [careers, player, tick],
  );

  const width = clampWidth(columns, 96);
  const height = clampHeight(rows, 26);
  const innerCols = width - 6;
  const innerRows = height - MODAL_CHROME;

  // The board's own chrome is only worth its rows when there is room to spare.
  // On a short terminal every row goes to the cards, which is the point.
  const showHeader = innerRows >= HEADER_MIN_ROWS;
  const showFooter = innerRows >= FOOTER_MIN_ROWS;
  const reserve =
    (showHeader ? BOARD_HEADER : 0) + (showFooter ? BOARD_FOOTER : 0);

  const layout = useMemo(
    () =>
      computeCareerGrid(
        innerCols,
        Math.max(1, innerRows - reserve),
        cards.length,
      ),
    [innerCols, innerRows, reserve, cards.length],
  );

  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [resignReport, setResignReport] = useState<ResignReport | null>(null);
  const [interviewing, setInterviewing] = useState(false);

  // A configured key turns hiring into a written test; without one the entry
  // gates are the whole story, which is the behaviour for a player who never
  // sets a key.
  const needsInterview = container.resolve(ConfigStore).getDeepseekApiKey().length > 0;

  const currentIndex = cards.findIndex((c) => c.state === "current");
  const summary = summarizeBoard(cards);

  // Esc backs out one level: detail → board → closed. Without this a modal
  // layer would own the keyboard with no way back to the game. While the
  // interview is up it owns Esc itself, so this stands down.
  useEffect(() => {
    if (interviewing) return;
    const u = boundKeyboard(["escape"], () => {
      if (detailId) {
        setDetailId(null);
        setNotice(null);
        setResignReport(null);
      } else {
        dismissModal(GJ_MODAL_ID);
      }
    });
    return () => u();
  }, [boundKeyboard, detailId, interviewing]);

  /** Affordability only — no charge, so it is safe to ask before a request. */
  const attemptRefusal = useCallback((): Notice | null => {
    if (!detailId) return { key: "career.err.unknown" };
    const refusal = careers.attemptBlocker(player, detailId);
    return refusal ? { key: refusal.key, params: refusal.params } : null;
  }, [careers, player, detailId]);

  /** Charge one application: its action points, and its cooldown. */
  const chargeAttempt = useCallback((): boolean => {
    if (!detailId) return false;
    const refusal = attemptRefusal();
    if (refusal) {
      setNotice(refusal);
      return false;
    }
    if (!careers.consumeAttempt(player, detailId)) return false;
    setNotice(null);
    setResignReport(null);
    return true;
  }, [careers, player, detailId, attemptRefusal]);

  /** Enter on a job: walk out of it, or apply for it. */
  const primaryAction = useCallback(() => {
    if (!detailId) return;
    const card = cards.find((c) => c.id === detailId);
    if (!card) return;

    if (card.state === "current") {
      const result = careers.resign(player);
      if (!result.ok) {
        setNotice({ key: result.blocker ?? "career.err.noJob" });
        return;
      }
      setNotice(null);
      setResignReport({
        cost: result.cost ?? {},
        cooldown: result.cooldown ?? 0,
        halfNotice: Boolean(result.halfNotice),
      });
      return;
    }

    // A life-long post elsewhere, or failing gates, are not affordability
    // problems — never charge for a job the player cannot take at all.
    if (card.state === "sealed") return;
    const blocker = careers.joinBlocker(player, detailId);
    if (blocker) {
      setNotice({ key: blocker });
      return;
    }
    if (needsInterview) {
      setInterviewing(true);
      return;
    }
    if (!chargeAttempt()) return;
    if (careers.join(player, detailId)) dismissModal(GJ_MODAL_ID);
  }, [careers, player, detailId, needsInterview, cards, chargeAttempt]);

  /** The interviewer said yes — hire on the spot. */
  const onPass = useCallback(() => {
    if (detailId && careers.join(player, detailId)) dismissModal(GJ_MODAL_ID);
  }, [careers, player, detailId]);

  // Enter acts on the job while the detail pane is open. The grid's own Enter
  // binding is gone by then — MenuList is unmounted — so these never collide.
  useEffect(() => {
    if (!detailId || interviewing) return;
    const u = boundKeyboard(["return"], primaryAction);
    return () => u();
  }, [boundKeyboard, detailId, interviewing, primaryAction]);

  const detail = detailId ? (cards.find((c) => c.id === detailId) ?? null) : null;
  const detailDef: CareerDefinition | undefined = detailId
    ? careers.get(detailId)
    : undefined;

  const items = useMemo(
    () => cards.map((c) => ({ value: c.id, label: t(c.labelKey) })),
    [cards, t],
  );

  // Exactly the rows `computeCareerGrid` proved fit. When the board needs more
  // than that — a genuinely tiny terminal, where no card shape can put every
  // job on one page — `MenuList` windows the grid by row and scrolls through
  // the rest, so the board never draws past the frame.
  const listHeight = layout.rows * layout.cardH;

  return (
    <ModalFrame
      width={width}
      height={height}
      title={`${t("careerBoard.title")}   ${t("careerBoard.openCount", {
        n: summary.available,
        total: summary.total,
      })}`}
      borderColor="white"
    >
      {interviewing && detail && detailDef ? (
        <CareerInterview
          player={player}
          def={detailDef}
          checkAttempt={attemptRefusal}
          onAttempt={chargeAttempt}
          onPass={onPass}
          onCancel={() => setInterviewing(false)}
        />
      ) : detail && detailDef ? (
        <CareerDetail
          card={detail}
          def={detailDef}
          player={player}
          notice={notice}
          resignReport={resignReport}
          needsInterview={needsInterview}
          innerCols={innerCols}
          onAct={primaryAction}
        />
      ) : (
        <>
          {showHeader ? (
            <BoardHeader summary={summary} width={innerCols} t={t} />
          ) : null}
          <MenuList
            items={items}
            focusId="career-board"
            wrap={false}
            columns={layout.cols}
            columnWidth={layout.cardW}
            rowHeight={layout.cardH}
            height={listHeight}
            colGap={2}
            // No marker column: a card is the whole cell, and the border colour
            // carries the selection instead.
            indicator={null}
            initialIndex={currentIndex >= 0 ? currentIndex : 0}
            onSelect={(item) => {
              setNotice(null);
              setResignReport(null);
              setDetailId(item.value);
            }}
            renderItem={(item, state) => {
              const card = cards.find((c) => c.id === item.value);
              return card ? (
                <JobCard
                  card={card}
                  size={layout.size}
                  state={state}
                  colors={colors}
                  t={t}
                />
              ) : null;
            }}
          />
          {showFooter ? (
            <Box flexDirection="column" alignItems="center" marginTop={1}>
              <Text dimColor>{t("careerBoard.hint.grid")}</Text>
              <Text dimColor>{t("careerBoard.hint.open")}</Text>
            </Box>
          ) : null}
        </>
      )}
    </ModalFrame>
  );
}

type Colors = ReturnType<typeof useThemeColors>;
type T = (key: string, params?: Record<string, string | number>) => string;

/** A refusal or status line shown under the action button. */
interface Notice {
  key: string;
  params?: Record<string, string | number>;
}

/** What resigning actually charged, shown once afterwards. */
interface ResignReport {
  cost: StatDelta;
  cooldown: number;
  halfNotice: boolean;
}

/** The one line above the grid: what the board is, and what state it is in. */
function BoardHeader({
  summary,
  width,
  t,
}: {
  summary: ReturnType<typeof summarizeBoard>;
  width: number;
  t: T;
}) {
  return (
    <Box width={width} flexDirection="row" justifyContent="space-between" marginBottom={1}>
      <Text dimColor wrap="truncate">
        {t("careerBoard.legend")}
      </Text>
      <Text dimColor wrap="truncate">
        {summary.cooling > 0
          ? `${t("careerBoard.state.cooling")} ${summary.cooling}   `
          : ""}
        {t("careerBoard.lockedCount", { n: summary.locked })}
      </Text>
    </Box>
  );
}

/** A job's card colour: what state the player is in relative to this job. */
function cardColor(card: CareerCard, colors: Colors): string {
  if (card.state === "current") return colors.success;
  if (card.state === "available") return colors.info;
  return colors.muted;
}

/**
 * The state mark, or nothing when there is nothing to say.
 *
 * An available job is the unmarked case — most of the board is available, and a
 * glyph on every card is noise. The cramped shapes drop it too: there the
 * border colour (or the text colour, on an unbordered row) already carries it.
 */
function stateGlyph(card: CareerCard, always = false): string {
  switch (card.state) {
    case "current":
      return "★";
    case "sealed":
      return "⛔";
    case "cooling":
      return "🕒";
    case "locked":
      return "🔒";
    default:
      return always ? "●" : "";
  }
}

/**
 * One job, at whichever size the board could afford.
 *
 * `full` is the bordered card with three lines; `compact` keeps the border but
 * one line, putting the salary where the field used to be; `line` drops the
 * border entirely, because two rows of border per card is more than a short
 * terminal can pay.
 */
function JobCard({
  card,
  size,
  state,
  colors,
  t,
}: {
  card: CareerCard;
  size: CardSize;
  state: { selected: boolean; focused: boolean; index: number };
  colors: Colors;
  t: T;
}) {
  const color = cardColor(card, colors);
  const active = state.focused && state.selected;
  const textColor = active ? color : card.state === "available" ? colors.text : colors.muted;
  const pay =
    card.state === "cooling"
      ? t("careerBoard.cooldownLeft", { n: card.cooldownYears })
      : `$${card.entrySalary}→$${card.topSalary}`;
  const payColor = card.state === "available" ? colors.money : colors.muted;

  if (size === "line") {
    return (
      <Box width="100%" flexDirection="row" overflow="hidden">
        <Text wrap="truncate" bold={active} color={textColor}>
          {active ? "❯ " : ""}
          {stateGlyph(card) ? `${stateGlyph(card)} ` : ""}
          {card.icon} {t(card.labelKey)}
          {"   "}
          <Text color={payColor}>{pay}</Text>
        </Text>
      </Box>
    );
  }

  if (size === "compact") {
    return (
      <Box
        width="100%"
        height={cardHeight("compact")}
        borderStyle="bold"
        borderColor={active ? color : "gray"}
        flexDirection="column"
        paddingX={1}
        overflowY="hidden"
      >
        <Text wrap="truncate" bold={active} color={textColor}>
          {card.icon} {t(card.labelKey)}
          {"   "}
          <Text color={payColor}>{pay}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box
      width="100%"
      height={cardHeight("full")}
      borderStyle="bold"
      borderColor={active ? color : "gray"}
      flexDirection="column"
      paddingX={1}
      overflowY="hidden"
    >
      <Text wrap="truncate" bold={active} color={textColor}>
        {card.icon} {t(card.labelKey)} {stateGlyph(card, true)}
      </Text>
      <Text wrap="truncate" dimColor>
        {t(card.fieldKey)}
        {card.mechanics.length > 0
          ? `  ${card.mechanics.map(mechanicGlyph).join("")}`
          : ""}
        {card.lifelong ? `  ${t("careerBoard.lifelongShort")}` : ""}
      </Text>
      <Text wrap="truncate" color={payColor}>
        {pay}
      </Text>
    </Box>
  );
}

/** A one-glyph badge per special mechanic, with the key it stands for. */
export function mechanicGlyph(m: string): string {
  switch (m) {
    case "commission":
      return "📊";
    case "public":
      return "📣";
    case "guild":
      return "🎓";
    case "hazard":
      return "⚠";
    default:
      return "";
  }
}

/** One entry gate, as a resolved line: `✓ 年龄 24/18` or `○ 颜值 40/75`. */
function GateLine({ gate, colors, t }: { gate: CareerGateStatus; colors: Colors; t: T }) {
  const name = t(gate.isNpc ? `npc.${gate.key}` : `playerConfig.attr.${gate.key}`);
  const need =
    gate.gte !== undefined
      ? `${gate.gte}`
      : gate.lte !== undefined
        ? `≤${gate.lte}`
        : "";
  return (
    <Text color={gate.met ? colors.success : colors.danger} wrap="truncate">
      {gate.met ? "✓" : "○"} {name} {Math.round(gate.value)}/{need}
    </Text>
  );
}

/** A stat delta rendered as `声望 -20`, or a placeholder when there is none. */
function deltaLine(cost: StatDelta, t: T, colors: Colors, emptyKey: string) {
  const entries = deltaEntries(cost);
  if (entries.length === 0) return <Text dimColor>{t(emptyKey)}</Text>;
  return (
    <Text color={colors.danger} wrap="truncate">
      {entries
        .map(([key, value]) => `${t(`playerConfig.attr.${key}`)} ${value > 0 ? "+" : ""}${value}`)
        .join("  ")}
    </Text>
  );
}

/**
 * The job, in two columns.
 *
 * Left: what it is, whether you qualify, and what it costs to leave. Right: the
 * ladder. Keeping the ladder beside the gates rather than under them is what
 * lets a 24-row terminal show a four-rung career without scrolling.
 */
function CareerDetail({
  card,
  def,
  player,
  notice,
  resignReport,
  needsInterview,
  innerCols,
  onAct,
}: {
  card: CareerCard;
  def: CareerDefinition;
  player: Player;
  notice: Notice | null;
  resignReport: ResignReport | null;
  needsInterview: boolean;
  innerCols: number;
  /** Enter: resign when the card is the current job, otherwise apply. */
  onAct: () => void;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const rungs = rankViews(player, def);
  const rank = player.careerRank;

  const leftW = Math.max(24, Math.floor(innerCols * 0.58) - 2);
  const stateKey =
    card.state === "current"
      ? "careerBoard.state.current"
      : card.state === "sealed"
        ? "careerBoard.state.sealed"
        : card.state === "cooling"
          ? "careerBoard.state.cooling"
          : card.state === "locked"
            ? "careerBoard.state.locked"
            : "careerBoard.state.open";

  return (
    <Box flexDirection="column">
      {/* title row spans both columns */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={cardColor(card, colors)} wrap="truncate">
          {card.icon} {t(card.labelKey)}
          <Text dimColor>
            {"  "}
            {t(card.fieldKey)}
          </Text>
          {card.lifelong ? (
            <Text color={colors.warning}>{"  "}{t("careerBoard.lifelong")}</Text>
          ) : null}
        </Text>
        <Text color={cardColor(card, colors)}>{t(stateKey)}</Text>
      </Box>

      <Box flexDirection="row" marginTop={1}>
        {/* ── left: the job and your standing against it ── */}
        <Box width={leftW} flexDirection="column" marginRight={2}>
          <Text wrap="wrap" color={colors.text}>
            {t(card.descKey)}
          </Text>

          <Box marginTop={1} flexDirection="row">
            <Text dimColor>{t("careerBoard.salaryRange")} </Text>
            <Text color={colors.money}>
              ${card.entrySalary} → ${card.topSalary}
            </Text>
          </Box>

          {card.mechanics.length > 0 ? (
            <Box flexDirection="column">
              {card.mechanics.map((m) => (
                <Text key={m} color={colors.warning} wrap="truncate">
                  {mechanicGlyph(m)} {t(`careerBoard.mech.${m}`)}
                </Text>
              ))}
            </Box>
          ) : null}

          <Box flexDirection="column" marginTop={1}>
            <Text bold dimColor>{t("careerBoard.entry")}</Text>
            {card.gates.length === 0 ? (
              <Text dimColor>{t("careerBoard.entry.none")}</Text>
            ) : (
              card.gates.map((g, i) => (
                <GateLine key={`${g.key}-${i}`} gate={g} colors={colors} t={t} />
              ))
            )}
          </Box>

          <Box flexDirection="column" marginTop={1}>
            <Text bold dimColor>{t("careerBoard.terms")}</Text>
            <Text dimColor wrap="truncate">
              {t("careerBoard.terms.apply", { n: card.terms.applyAp })}
              {card.terms.applyCooldown > 0
                ? ` · ${t("careerBoard.terms.cooldown", { n: card.terms.applyCooldown })}`
                : ` · ${t("careerBoard.terms.cooldown.none")}`}
            </Text>
            {card.lifelong ? (
              <Text dimColor wrap="wrap">{t("careerBoard.terms.resign.locked")}</Text>
            ) : (
              deltaLine(
                card.terms.resignCost,
                t,
                colors,
                "careerBoard.terms.resign.free",
              )
            )}
          </Box>
        </Box>

        {/* ── right: what you are buying into ── */}
        <Box flexDirection="column" flexGrow={1}>
          <Text bold dimColor>{t("careerBoard.ladder")}</Text>
          {rungs.map((r, i) => (
            <Box key={r.titleKey} flexDirection="column">
              <Text wrap="truncate">
                <Text color={i === rank ? colors.success : r.met ? "white" : colors.muted}>
                  {i === rank ? "▶" : " "} {i + 1}. {t(r.titleKey)}
                </Text>
              </Text>
              <Text dimColor wrap="truncate">
                {"     "}${r.salary}
                {r.gateCount > 0
                  ? `  ${t("careerBoard.ladder.gates", { met: r.metCount, total: r.gateCount })}`
                  : ""}
              </Text>
            </Box>
          ))}
          {card.cooldownYears > 0 ? (
            <Text color={colors.warning} wrap="truncate">
              {t("careerBoard.cooldownLeft", { n: card.cooldownYears })}
            </Text>
          ) : null}
        </Box>
      </Box>

      {/* ── action bar, always at the bottom ── */}
      <Box marginTop={1} flexDirection="column">
        {notice ? (
          <Text color={colors.danger} wrap="wrap">
            {t(notice.key, notice.params)}
          </Text>
        ) : null}
        {resignReport ? (
          <Box flexDirection="column">
            <Text color={colors.warning}>{t("careerBoard.resigned")}</Text>
            {deltaLine(resignReport.cost, t, colors, "careerBoard.terms.resign.free")}
            {resignReport.halfNotice ? (
              <Text color={colors.danger}>{t("careerBoard.resigned.short")}</Text>
            ) : null}
            {resignReport.cooldown > 0 ? (
              <Text color={colors.muted}>
                {t("careerBoard.resigned.cooldown", { n: resignReport.cooldown })}
              </Text>
            ) : null}
          </Box>
        ) : null}
        {card.unmet.length > 0 && !notice ? (
          <Text color={colors.danger}>
            {t("careerBoard.lockedReason", { n: card.unmet.length })}
          </Text>
        ) : null}
        <Box flexDirection="row" alignItems="center">
          <ActionButton
            card={card}
            colors={colors}
            t={t}
            needsInterview={needsInterview}
            onAct={onAct}
          />
          <Box marginLeft={2}>
            <Text dimColor>{t("careerBoard.hint.detail")}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** The one clickable control in the detail pane; Enter is bound by the board. */
function ActionButton({
  card,
  colors,
  t,
  needsInterview,
  onAct,
}: {
  card: CareerCard;
  colors: Colors;
  t: T;
  needsInterview: boolean;
  onAct: () => void;
}) {
  const enabled = card.state === "available";
  const resigning = card.state === "current";
  const clickable = enabled || (resigning && !card.lifelong);
  const color = enabled
    ? colors.success
    : resigning
      ? card.lifelong
        ? colors.muted
        : colors.warning
      : colors.muted;
  const ref = useMouseRegion({ onClick: () => (clickable ? onAct() : undefined) }, {
    priority: 1,
  });

  const apply =
    needsInterview
      ? t("careerBoard.action.interview")
      : t("careerBoard.action.join");
  const label = resigning
    ? card.lifelong
      ? t("careerBoard.action.lifelong")
      : `${t("careerBoard.action.resign")}  [Enter]`
    : card.state === "sealed"
      ? t("careerBoard.action.sealed")
      : enabled
        ? `${apply}  [Enter]`
        : card.state === "cooling"
          ? t("careerBoard.action.cooling")
          : t("careerBoard.action.blocked");

  return (
    <Box ref={ref} borderStyle="bold" borderColor={color} paddingX={2}>
      <Text color={color} bold={enabled || resigning}>
        {label}
      </Text>
    </Box>
  );
}
