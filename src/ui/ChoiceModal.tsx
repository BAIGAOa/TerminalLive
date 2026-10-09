import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { MenuList, ModalFrame } from "./kit/index.js";
import { useI18n } from "../core/language/LanguageContext.js";
import type { PendingChoice } from "../event/PendingChoice.js";
import { container } from "../Container.js";
import RelationshipSystem from "../world/relationships/RelationshipSystem.js";
import { NpcOfferIncident } from "../world/relationships/NpcOfferIncident.js";

/**
 * Modal dialog offering the player an event's branches. Rendered inside a
 * modal layer, so it owns keyboard + mouse input while open (the game screen
 * underneath is blocked, courtesy of ink-cartridge modal priority). Options
 * are pickable by clicking, by number key, or with ↑/↓ + Enter.
 */
export function ChoiceModal({
  choice,
  onResolve,
}: {
  choice: PendingChoice;
  onResolve: (optionId: string) => void;
}) {
  const { t } = useI18n();
  const { boundKeyboard } = useKeyboard();

  // An NPC asking something and the world rolling an event are answered in this
  // same dialog, so they have to look different: same frame, same colours and
  // the player cannot tell who is acting on them.
  const offeredBy =
    choice.incident instanceof NpcOfferIncident ? choice.incident.npcId : null;
  const npcName = offeredBy
    ? (() => {
        try {
          const detail = container.resolve(RelationshipSystem).getDetail(offeredBy);
          return detail ? t(detail.labelKey) : offeredBy;
        } catch {
          return offeredBy;
        }
      })()
    : null;

  const items = choice.options.map((o, i) => ({
    value: o.def.id,
    label: `${i + 1}. ${t(o.def.labelKey)}`,
    disabled: o.disabled,
  }));

  useEffect(() => {
    const unbinds = choice.options
      .map((o, i) =>
        i < 9 && !o.disabled
          ? boundKeyboard([String(i + 1)], () => onResolve(o.def.id))
          : null,
      )
      .filter((u): u is () => void => u !== null);
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, choice, onResolve]);

  return (
    <ModalFrame
      width={64}
      title={
        npcName
          ? t("choice.fromNpc", { name: npcName })
          : t(choice.nameKey ?? "choice.title")
      }
      borderColor={npcName ? "green" : "yellow"}
      draggable
    >
      <Box marginBottom={1}>
        <Text color="white">
          {choice.textKey ? t(choice.textKey) : t("choice.defaultText")}
        </Text>
      </Box>
      <MenuList
        focusId="choice-options"
        items={items}
        onSelect={(item) => onResolve(item.value)}
        renderItem={(item) => (
          <Text color={item.disabled ? "gray" : npcName ? "greenBright" : "yellowBright"}>
            {item.label}
            {item.disabled ? `  (${t("choice.locked")})` : ""}
          </Text>
        )}
      />
      <Box marginTop={1}>
        <Text dimColor>{t("choice.hint")}</Text>
      </Box>
    </ModalFrame>
  );
}
