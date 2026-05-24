import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { SelectInput, TextInput, useKeyboard } from '@baigao_h/ink-kit';
import type { Item } from '@baigao_h/ink-kit';
import Player from '../world/Player.js';
import { usePlayerConfig } from '../hooks/usePlayerConfig.js';
import { useTerminalSize } from './TerminalSizeContext.js';
import { useThemeColors } from '../hooks/theme/ThematicCommunicator.js';


function CategoryItem({ label, isSelected }: { label: string; value: string; isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="double"
      width="100%"
      height={4}
      borderColor={isSelected ? colors.highlight : colors.muted}
    >
      <Box justifyContent="center" width="100%" height={4}>
        <Text bold>{label}</Text>
      </Box>
    </Box>
  );
}

function AttributeItem({ label, isSelected, currentValue }: { label: string; value: string; isSelected: boolean; currentValue: string }) {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="round"
      width="100%"
      height={4}
      borderColor={isSelected ? colors.success : colors.muted}
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" width="100%" justifyContent="space-between">
        <Text bold color={isSelected ? colors.success : colors.text}>
          {label}
        </Text>
        <Text color={colors.warning}>{currentValue}</Text>
      </Box>
    </Box>
  );
}

function DefaultIndicator({ isSelected }: { isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box marginRight={1}>
      <Text color={isSelected ? colors.highlight : undefined}>
        {isSelected ? '❯' : ' '}
      </Text>
    </Box>
  );
}


interface PlayerConfigProps {
  player: Player;
  onBack?: () => void;
}

export default function PlayerConfig({ player, onBack }: PlayerConfigProps) {
  const data = usePlayerConfig(player, onBack);
  const { rows } = useTerminalSize();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    const unbind = boundKeyboard(['escape'], () => {
      data.onCancelEdit();
    });
    return () => unbind();
  }, [data.onCancelEdit, boundKeyboard]);

  const leftItems: Item<string>[] = data.leftItems.map((item) => ({
    label: item.label,
    value: item.value,
  }));

  const rightItems: (Item<string> & { currentValue: string })[] = data.rightItems.map((item) => ({
    label: item.label,
    value: item.value,
    currentValue: item.currentValue,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t('playerConfig.title')}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} height="100%">
        {/* 左侧分类菜单 — 编辑态隐藏 */}
        {!data.isEditing && (
          <Box borderStyle="bold" width="30%">
            <SelectInput
              items={leftItems}
              onSelect={(item) => {
                data.onSelectCategory(
                  data.leftItems.find((c) => c.value === item.value)!,
                );
              }}
              focusId="player-config-category"
              itemComponent={CategoryItem as any}
              indicatorComponent={DefaultIndicator}
            />
          </Box>
        )}

        <Box
          flexDirection="column"
          padding={1}
          width={data.isEditing ? "100%" : "70%"}
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
                  focusId="player-config-edit"
                />
              </Box>
              <Box>
                <Text dimColor>
                  {data.t('playerConfig.editHint')}
                </Text>
              </Box>
              {data.validationError && (
                <Box marginTop={1}>
                  <Text color={colors.error}>
                    {'✗ '}
                    {data.validationError}
                  </Text>
                </Box>
              )}
            </Box>
          ) : (
            <SelectInput
              items={rightItems}
              onSelect={(item) => {
                const attr = data.rightItems.find((a) => a.value === item.value);
                if (attr) data.onSelectAttribute(attr);
              }}
              focusId="player-config-attr"
              itemComponent={AttributeItem as any}
              indicatorComponent={DefaultIndicator}
            />
          )}
        </Box>
      </Box>

      {data.successMessage && (
        <Box marginTop={1} justifyContent="center">
          <Text color={colors.success}>
            {'✓ '}
            {data.successMessage}
          </Text>
        </Box>
      )}
    </Box>
  );
}