import React from "react"
import { Box, Text } from "ink"
import { useConfig, ConfigItem, SceneMenuItem } from "../hooks/useConfig.js"
import KeyboardMonitor from "../core/keys/KeyboardMonitor.js"
import { useTerminalSize } from "./TerminalSizeContext.js"
import { useKeyboardHandler } from "../hooks/key/useKeyBoardHandle.js"
import SelectInput from "../tools/ui/SelectInput.js"
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js"

const SceneMenuBox = (props: SceneMenuItem & { isSelected?: boolean }) => {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="double"
      width="100%"
      height={4}
      borderColor={props.isSelected ? colors.highlight : colors.muted}
    >
      <Box justifyContent="center" width="100%" height={4}>
        <Text bold>{props.label}</Text>
      </Box>
    </Box>
  );
};

const IconButton = ({
  text,
  color = "cyan",
  isSelected,
}: {
  text: string
  color?: string
  isSelected: boolean
}) => {
  const colors = useThemeColors();
  return (
    <Box
      width={10}
      height={3}
      borderStyle="single"
      borderColor={color}
      justifyContent="center"
      alignItems="center"
      marginX={1}
    >
      <Text color={isSelected ? colors.highlight : color}>{text}</Text>
    </Box>
  );
};

const BigButton = ({
  title,
  borderColor = "white",
  children,
  width = "100%",
  isSelected = false,
  highLightColor = "green",
}: {
  title: string
  borderColor?: string
  children?: React.ReactNode
  width?: string | number
  isSelected?: boolean
  highLightColor?: string
}) => {
  const colors = useThemeColors();
  return (
    <Box
      flexDirection="column"
      borderColor={isSelected ? highLightColor : borderColor}
      borderStyle="round"
      width={width}
      height={6}
      paddingX={1}
      marginBottom={1}
    >
      <Box marginTop={-1} marginLeft={1}>
        <Text
          backgroundColor={colors.background}
          color={isSelected ? colors.success : borderColor}
        >
          {" "}{title}{" "}
        </Text>
      </Box>
      <Box flexDirection="row" alignItems="center" flexGrow={1}>
        {children}
      </Box>
    </Box>
  );
};

const BigBoxItem = (props: ConfigItem & { isSelected?: boolean }) => (
  <BigButton
    title={props.title}
    borderColor={props.isBack ? "gray" : props.borderColor}
    isSelected={props.isSelected}
    width={props.width}
    highLightColor={props.isBack ? "red" : props.highLightColor}
  >
    <IconButton text={props.text} isSelected={!!props.isSelected} />
  </BigButton>
)

interface ConfigProps {
  onConfigChange?: (newMonitor: KeyboardMonitor) => void
  onBack?: () => void
}

export default function Config({ onConfigChange, onBack }: ConfigProps) {
  const data = useConfig(onConfigChange, onBack)
  const { rows } = useTerminalSize()
  const colors = useThemeColors();

  useKeyboardHandler((input, key) => {
    if (data.status.kind === "recording") {
      data.onKeyPress(input, key)
      return true
    }
    if (key.escape) {
      data.onKeyPress(input, key)
      return true
    }
    return false
  }, [data.status.kind, data.onKeyPress])

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle}>{data.t("config-title")}</Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} height="100%">
        <Box borderStyle="bold" width="30%">
          <SelectInput
            items={data.leftItems}
            onSelect={(item) => data.onSelectScene(item as SceneMenuItem)}
            itemComponent={SceneMenuBox as any}
            isFocused={data.isLeftFocused}
          />
        </Box>

        <Box
          flexDirection="column"
          padding={1}
          width="70%"
          borderStyle="single"
          borderColor={colors.info}
        >
          {data.focus === "left" && data.leftItems.length > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>← {data.t("config-selectSceneHint")}</Text>
            </Box>
          )}
          {data.focus === "right" && data.rightItems.length > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>{data.t("config-selectBindingHint")}</Text>
            </Box>
          )}

          {data.activeScene === null ? (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>{data.t("config-noSceneSelected")}</Text>
            </Box>
          ) : data.rightItems.length === 0 ? (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>{data.t("config-noBindings")}</Text>
            </Box>
          ) : (
            <SelectInput
              items={data.rightItems}
              onSelect={(item) => data.onSelectBinding(item as ConfigItem)}
              itemComponent={BigBoxItem as any}
              isFocused={data.isRightFocused}
            />
          )}
        </Box>
      </Box>

      {data.status.kind === "recording" && (
        <Box marginTop={1} borderStyle="double" borderColor={colors.info} padding={1}>
          <Text>{data.t("config-underModification")}</Text>
          <Text color={colors.menuTitle} bold>{data.status.editingOperate}</Text>
          <Text>{data.t("config-tip")}</Text>
        </Box>
      )}
      {data.status.kind === "saving" && (
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>Saving...</Text>
        </Box>
      )}
      {data.status.kind === "error" && (
        <Box marginTop={1}>
          <Text color={colors.error}>error: {data.status.message} {data.t("config-error")}</Text>
        </Box>
      )}
      {data.status.kind === "loading" && (
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>Loading...</Text>
        </Box>
      )}
    </Box>
  )
}