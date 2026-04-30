import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import Config from "./Config.js";
import { useSettingScreen, SettingMenu } from "../hooks/useSettingScreen.js";
import Player from "../world/Player.js";
import PlayerConfig from "./PlayerConfig.js";
import ModManager from "./ModManager.js";

interface SettingSelectedProps {
  label: string;
  value: SettingMenu;
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

  if (data.activeMenu === SettingMenu.keyBoardConfig) {
    return <Config onConfigChange={data.onConfigChange} onBack={data.onBack} />;
  }

  if (data.activeMenu === SettingMenu.playerConfig && player) {
    return <PlayerConfig player={player} onBack={data.onBack} />
  }

  if (data.activeMenu === SettingMenu.modManager) {
    return <ModManager onBack={data.onBack} />;
  }

  return (
    <Box flexDirection="column" padding={1} width="100%" alignItems="center" height={data.rows}>
      <Box width="100%" height={3} borderColor="white" borderStyle="round">
        <Box justifyContent="center" width="100%">
          <Text color="gray" bold>{data.t('setting.title')}</Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <SelectInput
          items={data.menuItems}
          onSelect={data.onSelectMenu as any}
          itemComponent={SettingBox as any}
        />
      </Box>
    </Box>
  );
}
