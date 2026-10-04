import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import RelationshipSystem from "../world/relationships/RelationshipSystem.js";
import Game from "../core/Game.js";
import { MenuList, ModalFrame } from "./kit/index.js";
import { dismissModal } from "./layers/modalBus.js";

const CLOSE_ID = "__close";

/**
 * The interaction dialog for a single NPC: a flavour line, then the actions the
 * player may take (talk / gift / help / …). Lives in a modal layer, so it owns
 * input while open; its list is the layer's first focus target (auto-focused).
 */
export default function NpcModal({ npcId }: { npcId: string }) {
  const { t } = useI18n();
  const { boundKeyboard } = useKeyboard();
  const system = container.resolve(RelationshipSystem);
  const game = container.resolve(Game);

  const [result, setResult] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // force refresh after an interaction

  const detail = system.getDetail(npcId);
  const dialogue = system.dialogue(npcId);
  const views = system.getInteractionsFor(npcId);

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => dismissModal("npc-modal"));
    return () => u();
  }, [boundKeyboard]);

  if (!detail) return null;

  const items = [
    ...views.map((v) => ({
      value: v.def.id,
      label: `${v.def.icon ?? "•"} ${t(v.def.labelKey)}`,
      disabled: !v.available,
    })),
    { value: CLOSE_ID, label: `✕ ${t("common.close")}`, disabled: false },
  ];

  const reasonText = (reason?: string): string =>
    reason === "ap"
      ? t("npc.it.reason.ap")
      : reason === "age"
        ? t("npc.it.reason.age")
        : reason === "gone"
          ? t("npc.it.reason.gone")
          : t("npc.it.reason.require");

  const choose = (id: string) => {
    if (id === CLOSE_ID) {
      dismissModal("npc-modal");
      return;
    }
    const def = views.find((v) => v.def.id === id)?.def;
    const ok = game.interactWithNpc(npcId, id);
    if (ok && def) setResult(def.resultKey);
    setTick((n) => n + 1);
  };

  return (
    <ModalFrame
      width={62}
      title={`${t("npc.detail.title", { name: t(detail.labelKey) })}  ♥ ${detail.affinity}`}
      borderColor="green"
      draggable
    >
      <Box flexDirection="column" key={tick}>
        <Text color="white">{dialogue ? t(dialogue) : t(detail.descKey)}</Text>
        {dialogue ? (
          <Box marginTop={1}>
            <Text dimColor>{t(detail.descKey)}</Text>
          </Box>
        ) : null}

        {detail.age !== undefined ? (
          <Text dimColor>
            {t(detail.stageKey ?? "npc.stage.adult")} ·{" "}
            {t("npc.detail.age", { n: detail.age })} ·{" "}
            {t(detail.statusKey ?? "npc.status.well")}
          </Text>
        ) : null}
        {detail.bond ? (
          <Text dimColor>
            {t("npc.bond.trust")} {detail.bond.trust} · {t("npc.bond.debt")}{" "}
            {detail.bond.debt} · {t("npc.bond.conflict")} {detail.bond.conflict}
          </Text>
        ) : null}

        <Box marginTop={1} flexDirection="column">
          <MenuList
            focusId="npc-interactions"
            items={items}
            onSelect={(item) => choose(item.value)}
            renderItem={(item, state) => {
              const view = views.find((v) => v.def.id === item.value);
              const cost = view?.def.apCost ?? 0;
              return (
                <Box flexDirection="row" flexGrow={1} justifyContent="space-between">
                  <Text
                    bold={state.selected && !item.disabled}
                    color={item.disabled ? "gray" : state.selected ? "greenBright" : "white"}
                  >
                    {item.label}
                    {item.disabled ? `  (${reasonText(view?.reason)})` : ""}
                  </Text>
                  <Text dimColor>{view ? `AP${cost}` : ""}</Text>
                </Box>
              );
            }}
          />
        </Box>

        {result ? (
          <Box marginTop={1}>
            <Text color="yellowBright">{t(result)}</Text>
          </Box>
        ) : null}

        <Box marginTop={1}>
          <Text dimColor>[↑↓⏎] {t("choice.hint")}   [Esc] {t("common.close")}</Text>
        </Box>
      </Box>
    </ModalFrame>
  );
}
