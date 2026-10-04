import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import { useFocusState } from "ink-cartridge";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import RelationshipSystem from "../../world/relationships/RelationshipSystem.js";
import Game from "../../core/Game.js";
import { ScrollList } from "../kit/index.js";
import NpcModal from "../NpcModal.js";
import { presentModal } from "../layers/modalBus.js";
import { useTerminalSize } from "../TerminalSizeContext.js";
import { bar } from "./common.js";

const CARD_HEIGHT = 3;

const ROLE_ICON: Record<string, string> = {
  "npc.role.family": "👪",
  "npc.role.friend": "🧑",
  "npc.role.mentor": "🎓",
  "npc.role.partner": "💞",
  "npc.role.work": "💼",
  "npc.role.pet": "🐾",
};

function affinityColor(v: number): string {
  if (v >= 70) return "green";
  if (v >= 40) return "yellow";
  if (v >= 20) return "white";
  return "red";
}

/**
 * The relationship page: a stack of NPC cards (↓/↑ select, ⏎ interact). The
 * cards share the "game-main" focus group with the action panel, so Tab toggles
 * between them; the header badge shows which panel currently owns the keyboard.
 * A detail panel fills the remaining height so the page never looks empty.
 */
export default function RelationshipsView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Rows the status panel gives this view (from the game screen). */
  height?: number;
}) {
  const npcReg = container.resolve(NpcRegistry);
  const system = container.resolve(RelationshipSystem);
  const game = container.resolve(Game);
  const { rows } = useTerminalSize();
  const contentH = height ?? Math.max(8, rows - 16);
  const focused = useFocusState("rel-cards", "game-main");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Depend on `relationships` so the cards refresh when affinity changes.
  const known = useMemo(
    () =>
      npcReg
        .getAll()
        .map((npc) => ({ npc, value: player.getRelationship(npc.id) }))
        .filter((k) => k.value > 0)
        .sort((a, b) => b.value - a.value),
    [npcReg, player.relationships],
  );

  if (known.length === 0) {
    return <Text dimColor>{t("game.relationships.empty")}</Text>;
  }

  const selected = known.find((k) => k.npc.id === selectedId) ?? known[0];
  const selectedDef = selected.npc;

  const items = known.map((k) => ({
    value: k.npc.id,
    label: t(k.npc.labelKey),
  }));

  const openNpc = (npcId: string) => {
    // Don't stack another modal while a choice is pending.
    if (game.getPendingChoice()) return;
    presentModal("npc-modal", NpcModal, { npcId });
  };

  // Budget the panel: a header line, as many cards as fit, an optional
  // "more below" line, and the detail box (only when there is room for it).
  const HEADER_H = 1;
  const DETAIL_H = 5; // border×2 + 3 content lines
  const HINT_H = 1;
  const roomAfterChrome = contentH - HEADER_H - HINT_H;
  const showDetail = roomAfterChrome >= CARD_HEIGHT + DETAIL_H;
  const listRows = Math.max(
    1,
    Math.floor((roomAfterChrome - (showDetail ? DETAIL_H : 0)) / CARD_HEIGHT),
  );
  const shown = Math.min(listRows, known.length);
  const hidden = known.length - shown;
  const listHeight = shown * CARD_HEIGHT;

  return (
    <Box flexDirection="column" width="100%" height={contentH}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={focused ? "cyanBright" : "gray"} wrap="truncate">
          {focused ? "▶" : " "} {t("game.relationships.title")}{" "}
          <Text dimColor>
            {t("game.relationships.count", { shown, total: known.length })}
          </Text>
        </Text>
      </Box>

      <ScrollList
        focusId="rel-cards"
        group="game-main"
        itemHeight={CARD_HEIGHT}
        height={listHeight}
        pageKeys={false}
        items={items}
        onChange={(item) => setSelectedId(item.value)}
        onSelect={(item) => openNpc(item.value)}
        renderItem={(item, state) => {
          const k = known.find((x) => x.npc.id === item.value);
          if (!k) return <Text> </Text>;
          const icon = ROLE_ICON[k.npc.roleKey ?? ""] ?? "👤";
          const active = state.focused && state.selected;
          return (
            <Box
              flexDirection="row"
              borderStyle="round"
              borderColor={active ? "greenBright" : "gray"}
              paddingX={1}
              width="100%"
              justifyContent="space-between"
            >
              <Text
                bold={active}
                wrap="truncate"
                color={active ? "greenBright" : "white"}
              >
                {active ? "❯ " : "  "}
                {icon} {t(k.npc.labelKey)}
              </Text>
              <Text color={affinityColor(k.value)}>
                {bar(k.value, 10)} ♥{k.value}
              </Text>
            </Box>
          );
        }}
      />

      {hidden > 0 ? (
        <Text color="yellow" wrap="truncate">
          {t("game.relationships.more", { n: hidden })}
        </Text>
      ) : null}

      {showDetail ? (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          flexGrow={1}
        >
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold color="cyan" wrap="truncate">
              {t(selectedDef.labelKey)}
            </Text>
            <Text color={affinityColor(selected.value)}>
              {t("npc.detail.affinity", { value: selected.value })}
            </Text>
          </Box>
          <Text dimColor wrap="truncate">
            {selectedDef.temperamentKey
              ? `${t("npc.detail.temperament")}: ${t(selectedDef.temperamentKey)} · `
              : ""}
            {t(selectedDef.descKey)}
          </Text>
          <Text color="greenBright">
            {t("npc.detail.interact", {
              n: system.getDetail(selectedDef.id)?.availableInteractions ?? 0,
            })}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
