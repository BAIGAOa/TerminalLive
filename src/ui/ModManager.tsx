import React from "react";
import { Box, Text, useInput } from "ink";
import { useModScreen } from "../hooks/useModScreen.js";

export default function ModManager({ onBack }: { onBack?: () => void }) {
  const data = useModScreen(onBack);

  useInput((input, key) => {
    data.handleKeyPress(input, key);
  });

  return (
    <Box flexDirection="column" padding={1} width="100%" height={data.rows}>
      {/* 标题 */}
      <Box justifyContent="center" marginBottom={1}>
        <Text color="yellow" bold>
          {data.t("mod.title")}
        </Text>
      </Box>

      {/* mod列表 */}
      {data.mods.length === 0 ? (
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text dimColor>{data.t("mod.noMods")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {data.mods.map((mod, index) => {
            const isSelected = index === data.selectedIndex;
            return (
              <Box
                key={mod.name}
                borderStyle="round"
                borderColor={isSelected ? "green" : "gray"}
                paddingX={1}
                marginBottom={1}
              >
                <Text color={isSelected ? "green" : "white"} bold={isSelected}>
                  {mod.enabled ? "[✓]" : "[ ]"} {mod.name}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 底部提示 */}
      <Box marginTop={1}>
        <Text dimColor>{data.t("mod.restartHint")}</Text>
      </Box>
    </Box>
  );
}