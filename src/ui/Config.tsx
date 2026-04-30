import React from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useConfig, ConfigItem, SceneMenuItem } from "../hooks/useConfig.js";
import KeyboardMonitor from "../core/keys/KeyboardMonitor.js";
import { useTerminalSize } from "./TerminalSizeContext.js";

// ============================================================
// 子组件
// ============================================================

/** 左侧场景菜单项 */
const SceneMenuBox = (props: SceneMenuItem & { isSelected?: boolean }) => (
  <Box
    borderStyle="double"
    width="100%"
    height={4}
    borderColor={props.isSelected ? "blue" : "gray"}
  >
    <Box justifyContent="center" width="100%" height={4}>
      <Text bold>{props.label}</Text>
    </Box>
  </Box>
);

/** 右侧绑定项 */
const IconButton = ({
  text,
  color = "cyan",
  isSelected,
}: {
  text: string;
  color?: string;
  isSelected: boolean;
}) => (
  <Box
    width={10}
    height={3}
    borderStyle="single"
    borderColor={color}
    justifyContent="center"
    alignItems="center"
    marginX={1}
  >
    <Text color={isSelected ? "green" : color}>{text}</Text>
  </Box>
);

const BigButton = ({
  title,
  borderColor = "white",
  children,
  width = "100%",
  isSelected = false,
  highLightColor = "green",
}: {
  title: string;
  borderColor?: string;
  children?: React.ReactNode;
  width?: string | number;
  isSelected?: boolean;
  highLightColor?: string;
}) => (
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
        backgroundColor="black"
        color={isSelected ? "green" : borderColor}
      >
        {" "}{title}{" "}
      </Text>
    </Box>
    <Box flexDirection="row" alignItems="center" flexGrow={1}>
      {children}
    </Box>
  </Box>
);

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
);

// ============================================================
// 主组件
// ============================================================

interface ConfigProps {
  onConfigChange?: (newMonitor: KeyboardMonitor) => void;
  onBack?: () => void;
}

export default function Config({ onConfigChange, onBack }: ConfigProps) {
  const data = useConfig(onConfigChange, onBack);
  const { rows } = useTerminalSize();

  // 全局按键
  useInput((input, key) => {
    data.onKeyPress(input, key);
  });

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      {/* 标题 */}
      <Box justifyContent="center" marginBottom={1}>
        <Text color="yellow">{data.t("config-title")}</Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} height="100%">
        {/* 左侧场景菜单 */}
        <Box borderStyle="bold" width="30%">
          <SelectInput
            items={data.leftItems}
            onSelect={data.onSelectScene as any}
            itemComponent={SceneMenuBox as any}
            isFocused={data.isLeftFocused}
          />
        </Box>

        {/* 右侧绑定列表 */}
        <Box
          flexDirection="column"
          padding={1}
          width="70%"
          borderStyle="single"
          borderColor="cyan"
        >
          {/* 提示 */}
          {data.focus === "left" && data.leftItems.length > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>
                ← {data.t("config-selectSceneHint")}
              </Text>
            </Box>
          )}

          {data.focus === "right" && data.rightItems.length > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>
                {data.t("config-selectBindingHint")}
              </Text>
            </Box>
          )}

          {/* 绑定列表 */}
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
              onSelect={data.onSelectBinding as any}
              itemComponent={BigBoxItem as any}
              isFocused={data.isRightFocused}
            />
          )}
        </Box>
      </Box>

      {/* 状态消息 */}
      {data.status.kind === "recording" && (
        <Box marginTop={1} borderStyle="double" borderColor="cyan" padding={1}>
          <Text>{data.t("config-underModification")}</Text>
          <Text color="yellow" bold>
            {data.status.editingOperate}
          </Text>
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
          <Text color="red">
            error: {data.status.message} {data.t("config-error")}
          </Text>
        </Box>
      )}

      {data.status.kind === "loading" && (
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>Loading...</Text>
        </Box>
      )}
    </Box>
  );
}
