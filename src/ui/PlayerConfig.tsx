import React from 'react';
import { Box, Text } from 'ink';
import Player from '../world/Player.js';
import {
  usePlayerConfig,
  CategoryMenuItem,
  AttributeItem,
} from '../hooks/usePlayerConfig.js';
import { useTerminalSize } from './TerminalSizeContext.js';
import { useKeyboardHandler } from '../hooks/key/useKeyBoardHandle.js';
import SelectInput from '../tools/ui/SelectInput.js';
import TextInput from '../tools/ui/TextInput.js';
import { useThemeColors } from '../hooks/theme/ThematicCommunicator.js';


const CategoryMenuBox = (props: CategoryMenuItem & { isSelected?: boolean }) => {
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

const AttributeRow = (props: AttributeItem & { isSelected?: boolean }) => {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="round"
      width="100%"
      height={4}
      borderColor={props.isSelected ? colors.success : colors.muted}
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" width="100%" justifyContent="space-between">
        <Text bold color={props.isSelected ? colors.success : colors.text}>
          {props.label}
        </Text>
        <Text color={colors.warning}>{props.currentValue}</Text>
      </Box>
    </Box>
  );
};


interface PlayerConfigProps {
  player: Player;
  onBack?: () => void;
}

export default function PlayerConfig({ player, onBack }: PlayerConfigProps) {
  const data = usePlayerConfig(player, onBack);
  const { rows } = useTerminalSize();
  const colors = useThemeColors();

  useKeyboardHandler((_input, key) => {
    if (key.escape) { data.onCancelEdit(); return true }
    return false
  })

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t('playerConfig.title')}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} height="100%">
        <Box borderStyle="bold" width="30%">
          <SelectInput
            items={data.leftItems}
            onSelect={data.onSelectCategory as any}
            itemComponent={CategoryMenuBox as any}
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
          {!data.isEditing && data.focus === 'left' && (
            <Box marginBottom={1}>
              <Text dimColor>
                ← {data.t('playerConfig.selectCategoryHint')}
              </Text>
            </Box>
          )}

          {!data.isEditing && data.focus === 'right' && data.rightItems.length > 0 && (
            <Box marginBottom={1}>
              <Text dimColor>
                {data.t('playerConfig.selectAttrHint')}
              </Text>
            </Box>
          )}

          {data.activeCategory === null ? (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>{data.t('playerConfig.noCategorySelected')}</Text>
            </Box>
          ) : data.isEditing ? (
            <Box flexDirection="column" flexGrow={1}>
              <Box marginBottom={1}>
                <Text bold color={colors.success}>
                  {data.editingLabel}:{' '}
                </Text>
              </Box>
              <Box marginBottom={1}>
                <TextInput
                  value={data.editValue}
                  onChange={data.onEditChange}
                  onSubmit={data.onSubmitEdit}
                />
              </Box>
              <Box>
                <Text dimColor>
                  {data.t('playerConfig.editHint')}
                </Text>
              </Box>
              {data.validationError && (
                <Box marginTop={1}>
                  <Text color={colors.error}>✗ {data.validationError}</Text>
                </Box>
              )}
            </Box>
          ) : (
            <SelectInput
              items={data.rightItems}
              onSelect={data.onSelectAttribute as any}
              itemComponent={AttributeRow as any}
              isFocused={data.isRightFocused}
            />
          )}
        </Box>
      </Box>

      {data.successMessage && (
        <Box marginTop={1} justifyContent="center">
          <Text color={colors.success}>✓ {data.successMessage}</Text>
        </Box>
      )}
    </Box>
  );
}