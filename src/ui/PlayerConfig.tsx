import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Player from '../world/Player.js';
import {
  usePlayerConfig,
  CategoryMenuItem,
  AttributeItem,
} from '../hooks/usePlayerConfig.js';
import { useTerminalSize } from './TerminalSizeContext.js';

// ============================================================
// 子组件
// ============================================================

const CategoryMenuBox = (props: CategoryMenuItem & { isSelected?: boolean }) => (
  <Box
    borderStyle="double"
    width="100%"
    height={4}
    borderColor={props.isSelected ? 'blue' : 'gray'}
  >
    <Box justifyContent="center" width="100%" height={4}>
      <Text bold>{props.label}</Text>
    </Box>
  </Box>
);

const AttributeRow = (props: AttributeItem & { isSelected?: boolean }) => (
  <Box
    borderStyle="round"
    width="100%"
    height={4}
    borderColor={props.isSelected ? 'green' : 'gray'}
    paddingX={1}
    marginBottom={1}
  >
    <Box flexDirection="row" width="100%" justifyContent="space-between">
      <Text bold color={props.isSelected ? 'green' : 'white'}>
        {props.label}
      </Text>
      <Text color="yellow">{props.currentValue}</Text>
    </Box>
  </Box>
);

// ============================================================
// 主组件
// ============================================================

interface PlayerConfigProps {
  player: Player;
  onBack?: () => void;
}

export default function PlayerConfig({ player, onBack }: PlayerConfigProps) {
  const data = usePlayerConfig(player, onBack);
  const { rows } = useTerminalSize();

  
  useInput((_input, key) => {
    if (key.escape) {
      data.onCancelEdit();
    }
  });

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      {/* 标题 */}
      <Box justifyContent="center" marginBottom={1}>
        <Text color="yellow" bold>
          {data.t('playerConfig.title')}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} height="100%">
        {/* 左侧分类菜单 */}
        <Box borderStyle="bold" width="30%">
          <SelectInput
            items={data.leftItems}
            onSelect={data.onSelectCategory as any}
            itemComponent={CategoryMenuBox as any}
            isFocused={data.isLeftFocused}
          />
        </Box>

        {/* 右侧属性区域 */}
        <Box
          flexDirection="column"
          padding={1}
          width="70%"
          borderStyle="single"
          borderColor="cyan"
        >
          {/* 提示 */}
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

          {/* 未选择分类 */}
          {data.activeCategory === null ? (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>{data.t('playerConfig.noCategorySelected')}</Text>
            </Box>
          ) : data.isEditing ? (
            /* 编辑模式 */
            <Box flexDirection="column" flexGrow={1}>
              <Box marginBottom={1}>
                <Text bold color="green">
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
                  <Text color="red">✗ {data.validationError}</Text>
                </Box>
              )}
            </Box>
          ) : (
            /* 属性列表 */
            <SelectInput
              items={data.rightItems}
              onSelect={data.onSelectAttribute as any}
              itemComponent={AttributeRow as any}
              isFocused={data.isRightFocused}
            />
          )}
        </Box>
      </Box>

      {/* 成功消息 */}
      {data.successMessage && (
        <Box marginTop={1} justifyContent="center">
          <Text color="green">✓ {data.successMessage}</Text>
        </Box>
      )}
    </Box>
  );
}
