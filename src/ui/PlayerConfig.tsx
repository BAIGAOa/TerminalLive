import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { MenuList, TextField } from "./kit/index.js";
import Player from "../world/Player.js";
import { usePlayerConfig } from "../hooks/usePlayerConfig.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { container } from "../Container.js";
import WorldManager from "../worlds/WorldManager.js";

interface PlayerConfigProps {
  player?: Player;
  onBack?: () => void;
}

export default function PlayerConfig({ player: playerProp, onBack }: PlayerConfigProps) {
  const player = playerProp ?? container.resolve(WorldManager).getPlayer();
  const data = usePlayerConfig(player, onBack);
  const { rows } = useTerminalSize();
  const colors = useThemeColors();
  const { boundKeyboard, focusSet } = useKeyboard();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => data.onCancelEdit());
    return () => u();
  }, [data.onCancelEdit, boundKeyboard]);

  // Move keyboard focus with the panel: otherwise the right-hand attribute list
  // is unreachable (it only ever got focus from mouse hover).
  useEffect(() => {
    const id = data.focus === "right" ? "player-config-attr" : "player-config-category";
    try {
      focusSet(id);
    } catch {
      /* target not registered yet */
    }
  }, [data.focus, focusSet]);

  const leftItems = data.leftItems.map((c) => ({
    value: c.value,
    label: c.label,
  }));
  const rightItems = data.rightItems.map((a) => ({
    value: a.value,
    label: a.label,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t("playerConfig.title")}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1}>
        {!data.isEditing && (
          <Box width="30%" marginRight={1}>
            <MenuList
              focusId="player-config-category"
              items={leftItems}
              onSelect={(item) => {
                const cat = data.leftItems.find((c) => c.value === item.value);
                if (cat) data.onSelectCategory(cat);
              }}
              renderItem={(item, state) => (
                <Box
                  borderStyle="bold"
                  borderColor={state.selected ? colors.highlight : colors.muted}
                  paddingX={1}
                  justifyContent="center"
                >
                  <Text bold={state.selected}>{item.label}</Text>
                </Box>
              )}
            />
          </Box>
        )}

        <Box
          flexDirection="column"
          padding={1}
          width={data.isEditing ? "100%" : "70%"}
          borderStyle="bold"
          borderColor={colors.info}
        >
          {data.activeCategory === null ? (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>{data.t("playerConfig.noCategorySelected")}</Text>
            </Box>
          ) : data.isEditing ? (
            <Box flexDirection="column" flexGrow={1}>
              <Box marginBottom={1}>
                <Text bold color={colors.success}>
                  {data.editingLabel}:{" "}
                </Text>
              </Box>
              <Box marginBottom={1}>
                <TextField
                  value={data.editValue}
                  onChange={data.onEditChange}
                  onSubmit={data.onSubmitEdit}
                  focusId="player-config-edit"
                />
              </Box>
              <Text dimColor>{data.t("playerConfig.editHint")}</Text>
              {data.validationError && (
                <Box marginTop={1}>
                  <Text color={colors.error}>
                    {"✗ "}
                    {data.validationError}
                  </Text>
                </Box>
              )}
            </Box>
          ) : (
            <MenuList
              focusId="player-config-attr"
              items={rightItems}
              onSelect={(item) => {
                const attr = data.rightItems.find((a) => a.value === item.value);
                if (attr) data.onSelectAttribute(attr);
              }}
              renderItem={(item, state) => {
                const attr = data.rightItems.find((a) => a.value === item.value);
                return (
                  <Box
                    flexDirection="row"
                    flexGrow={1}
                    justifyContent="space-between"
                    borderStyle="bold"
                    borderColor={state.selected ? colors.success : colors.muted}
                    paddingX={1}
                  >
                    <Text bold={state.selected}>{item.label}</Text>
                    <Text color={colors.warning}>{attr?.currentValue}</Text>
                  </Box>
                );
              }}
            />
          )}
        </Box>
      </Box>

      {data.successMessage && (
        <Box marginTop={1} justifyContent="center">
          <Text color={colors.success}>
            {"✓ "}
            {data.successMessage}
          </Text>
        </Box>
      )}
    </Box>
  );
}
