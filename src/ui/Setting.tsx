import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { SETTING_MENU, useSettingScreen } from "../hooks/useSettingScreen.js";
import Player from "../world/Player.js";
import { SettingRegistry } from "../core/store/SettingRegistry.js";
import { container } from "../Container.js";

interface SettingSelectedProps {
  label: string;
  value: string;
  highlightColor: string;
  isSelected?: boolean;
}

function SettingBox({ label, isSelected, highlightColor }: SettingSelectedProps) {
  return (
    <Box width={40} borderStyle="round"
      borderColor={isSelected ? highlightColor : 'yellow'} paddingX={1} marginBottom={1}>
      <Box justifyContent="center" width="100%">
        <Text color={isSelected ? highlightColor : 'white'} bold={isSelected}>{label}</Text>
      </Box>
    </Box>
  );
}

interface SettingProps {
  onConfigChange?: (newMonitor: any) => void;
  player?: Player
}

export default function Setting({ onConfigChange, player }: SettingProps) {
  const data = useSettingScreen(onConfigChange);
  const registry = container.resolve(SettingRegistry);

  if (data.activeMenu !== SETTING_MENU.none) {
    const entry = registry.getEntry(data.activeMenu);
    if (entry) {
      return <entry.component
        onConfigChange={data.onConfigChange}
        onBack={data.onBack}
        player={player}
      />;
    }
  }

  const items = registry.getAll().map((e) => ({
    label: data.t(e.nameKey),
    value: e.menu,
    highlightColor: "green" as const,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" alignItems="center" height={data.rows}>
      <Box width="100%" height={3} borderColor="white" borderStyle="round">
        <Box justifyContent="center" width="100%">
          <Text color="gray" bold>{data.t("setting.title")}</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={data.onSelectMenu as any}
          itemComponent={SettingBox as any}
        />
      </Box>
    </Box>
  );
}
