import React, { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import { useFocusState } from "ink-cartridge";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import RelationshipSystem from "../../world/relationships/RelationshipSystem.js";
import Game from "../../core/Game.js";
import { ScrollList } from "../kit/index.js";
import NpcModal from "../NpcModal.js";
import { dismissModal, presentModal } from "../layers/modalBus.js";
import { NPC_MODAL_ID } from "../layers/layerIds.js";
import { useTerminalSize } from "../TerminalSizeContext.js";
import { useThemeColors } from "../../hooks/theme/ThematicCommunicator.js";
import { bar } from "./common.js";
import {
  affinityColor,
  CARD_HEIGHT,
  fitRelationshipPanel,
  ROLE_ICON,
} from "./relationshipLayout.js";

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
  const colors = useThemeColors();
  const contentH = height ?? Math.max(8, rows - 16);
  const focused = useFocusState("rel-cards", "game-main");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The NPC dialog is a modal layer; when this view unmounts (navigating away)
  // its cleanup must dismiss the layer, or a stale modal would linger on screen
  // above the next screen. Mirrors WorldGame's modal effects.
  useEffect(() => {
    return () => dismissModal(NPC_MODAL_ID);
  }, []);

  // Depend on `relationships` so the cards refresh when affinity changes.
  const known = useMemo(
    () =>
      npcReg
        .getAll()
        .map((npc) => ({ npc, value: player.getRelationship(npc.id) }))
        // Only NPCs the player has actually met *and* is old enough to know.
        .filter((k) => k.value > 0 && system.isKnown(k.npc.id))
        .sort((a, b) => b.value - a.value),
    [npcReg, player.relationships, system],
  );

  if (known.length === 0) {
    return <Text dimColor>{t("game.relationships.empty")}</Text>;
  }

  const selected = known.find((k) => k.npc.id === selectedId) ?? known[0];
  const selectedDef = selected.npc;
  const detail = system.getDetail(selectedDef.id);

  const items = known.map((k) => ({
    value: k.npc.id,
    label: t(k.npc.labelKey),
  }));

  const openNpc = (npcId: string) => {
    // Don't stack another modal while a choice is pending.
    if (game.getPendingChoice()) return;
    presentModal(NPC_MODAL_ID, NpcModal, { npcId });
  };

  // Budget the panel: a header line, as many cards as fit, an optional
  // "more below" line, and the detail box (only when there is room for it).
  const { showDetail, shown, hidden, listHeight } = fitRelationshipPanel(
    contentH,
    known.length,
  );

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
              borderStyle="bold"
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
              <Text color={affinityColor(k.value, colors)}>
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
          borderStyle="bold"
          borderColor="cyan"
          paddingX={1}
          flexGrow={1}
        >
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold color="cyan" wrap="truncate">
              {t(selectedDef.labelKey)}
            </Text>
            <Text color={affinityColor(selected.value, colors)}>
              {t("npc.detail.affinity", { value: selected.value })}
            </Text>
          </Box>
          <Text dimColor wrap="truncate">
            {selectedDef.temperamentKey
              ? `${t("npc.detail.temperament")}: ${t(selectedDef.temperamentKey)} · `
              : ""}
            {t(selectedDef.descKey)}
          </Text>
          {detail?.age !== undefined ? (
            <>
              <Text dimColor wrap="truncate">
                {t(detail.stageKey ?? "npc.stage.adult")} ·{" "}
                {t("npc.detail.age", { n: detail.age })} ·{" "}
                {t(detail.statusKey ?? "npc.status.well")}
              </Text>
              <Text dimColor wrap="truncate">
                {t("npc.detail.vitals", {
                  h: detail.health ?? 0,
                  w: detail.wealth ?? 0,
                })}
              </Text>
            </>
          ) : null}
          {detail?.bond ? (
            <Text dimColor wrap="truncate">
              {t("npc.bond.trust")} {bar(detail.bond.trust, 6)}
              {"  "}
              {t("npc.bond.conflict")} {bar(detail.bond.conflict, 6)}
            </Text>
          ) : null}
          <Text color="greenBright">
            {t("npc.detail.interact", {
              n: detail?.availableInteractions ?? 0,
            })}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
