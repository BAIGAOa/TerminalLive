import React from "react"
import { Box, Text } from "ink"
import { useModScreen } from "../hooks/useModScreen.js"
import { useKeyboardHandler } from "../hooks/key/useKeyBoardHandle.js"

export default function ModManager({ onBack }: { onBack?: () => void }) {
  const { mods, selectedIndex, setSelectedIndex, toggleMod, rows, t } =
    useModScreen()

  // 全局键盘监听 只在当前页面生效 消费事件防止穿透
  useKeyboardHandler(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1))
        return true
      }
      if (key.downArrow) {
        setSelectedIndex(Math.min(mods.length - 1, selectedIndex + 1))
        return true
      }
      if (key.return) {
        if (mods.length > 0) {
          toggleMod(mods[selectedIndex].name)
        }
        return true
      }
      if (key.escape) {
        onBack?.()
        return true
      }
      return false
    },
    [mods, selectedIndex, toggleMod, onBack],
  )

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color="yellow" bold>
          {t("mod.title")}
        </Text>
      </Box>

      {mods.length === 0 ? (
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text dimColor>{t("mod.noMods")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {mods.map((mod, index) => {
            const isSelected = index === selectedIndex
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
            )
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{t("mod.restartHint")}</Text>
      </Box>
    </Box>
  )
}