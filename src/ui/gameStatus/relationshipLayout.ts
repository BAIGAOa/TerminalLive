/** Pure helpers for the relationships view: the card-panel budget and the
 * role/affinity presentation maps. React-free so they can be unit-tested. */

/** Every relationship card occupies exactly this many rows. */
export const CARD_HEIGHT = 3;

export const ROLE_ICON: Record<string, string> = {
  "npc.role.family": "👪",
  "npc.role.friend": "🧑",
  "npc.role.mentor": "🎓",
  "npc.role.partner": "💞",
  "npc.role.work": "💼",
  "npc.role.pet": "🐾",
};

/** Minimal theme colors the affinity scale needs (structurally a ThemeColors). */
export interface AffinityColors {
  success: string;
  warning: string;
  text: string;
  danger: string;
}

/** Affinity → theme color: high = success, low = danger. */
export function affinityColor(v: number, colors: AffinityColors): string {
  if (v >= 70) return colors.success;
  if (v >= 40) return colors.warning;
  if (v >= 20) return colors.text;
  return colors.danger;
}

export interface RelationshipPanelLayout {
  /** Whether there is room for the NPC detail box below the cards. */
  showDetail: boolean;
  /** Card rows the panel can show (before clamping to the card count). */
  listRows: number;
  /** Cards actually rendered. */
  shown: number;
  /** Cards hidden below the fold (drives the "N more" line). */
  hidden: number;
  /** Height passed to the ScrollList = shown * CARD_HEIGHT. */
  listHeight: number;
}

const HEADER_H = 1;
const DETAIL_H = 5; // border×2 + 3 content lines
const HINT_H = 1;

/**
 * Budget the panel: a header line, as many cards as fit, an optional
 * "more below" line, and the detail box (only when there is room for it).
 */
export function fitRelationshipPanel(
  contentH: number,
  cardCount: number,
): RelationshipPanelLayout {
  const roomAfterChrome = contentH - HEADER_H - HINT_H;
  const showDetail = roomAfterChrome >= CARD_HEIGHT + DETAIL_H;
  const listRows = Math.max(
    1,
    Math.floor((roomAfterChrome - (showDetail ? DETAIL_H : 0)) / CARD_HEIGHT),
  );
  const shown = Math.min(listRows, cardCount);
  const hidden = cardCount - shown;
  return {
    showDetail,
    listRows,
    shown,
    hidden,
    listHeight: shown * CARD_HEIGHT,
  };
}
