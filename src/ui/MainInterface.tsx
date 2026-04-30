

import React, { ReactNode } from 'react';
import { Box, Text, BoxProps } from 'ink';

type Size = number | string;

/** 边距配置：数字（四边相同）或对象（分别指定各边） */
type SpacingValue = number | { top?: number; bottom?: number; left?: number; right?: number };


export interface MainInterfaceProps extends Omit<BoxProps, 'margin' | 'padding' | 'width' | 'height'> {
  margin?: SpacingValue;
  padding?: SpacingValue;
  width?: Size;
  height?: Size;
  isHighlighted?: boolean;
  highlightBackgroundColor?: string;
  title?: string;
  textColor?: string;
  children?: ReactNode
}

const DEFAULT_CONFIG = {
  width: '100%' as Size,
  height: '100%' as Size,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  textColor: 'white',
  backgroundColor: 'black',
  isHighlighted: false,
  highlightBackgroundColor: 'green',
  borderStyle: 'bold' as BoxProps['borderStyle'],
  margin: 4 as SpacingValue,
  padding: 1 as SpacingValue,
};

/**
 * 将简化的间距配置转换为 Ink Box 接受的独立属性
 */
function normalizeSpacing(
  value: SpacingValue | undefined,
  prefix: 'margin' | 'padding'
): BoxProps {
  if (value === undefined) return {};
  if (typeof value === 'number') {
    return {
      [`${prefix}Top`]: value,
      [`${prefix}Bottom`]: value,
      [`${prefix}Left`]: value,
      [`${prefix}Right`]: value,
    };
  }
  return {
    [`${prefix}Top`]: value.top,
    [`${prefix}Bottom`]: value.bottom,
    [`${prefix}Left`]: value.left,
    [`${prefix}Right`]: value.right,
  };
}

/**
 * 主界面容器组件
 */
const MainInterface: React.FC<MainInterfaceProps> = (props) => {
  const {
    // 布局
    width = DEFAULT_CONFIG.width,
    height = DEFAULT_CONFIG.height,
    alignItems = DEFAULT_CONFIG.alignItems,
    justifyContent = DEFAULT_CONFIG.justifyContent,
    borderStyle = DEFAULT_CONFIG.borderStyle,
    
    // 状态与颜色
    backgroundColor: propBackgroundColor,
    isHighlighted = DEFAULT_CONFIG.isHighlighted,
    highlightBackgroundColor = DEFAULT_CONFIG.highlightBackgroundColor,
    textColor = DEFAULT_CONFIG.textColor,
    
    // 间距
    margin = DEFAULT_CONFIG.margin,
    padding = DEFAULT_CONFIG.padding,
    
    // 内容
    title,
    children,
    // 透传所有其他 Ink Box 属性 (flexDirection, flexGrow, etc.)
    ...rest
  } = props;

  // 1. 计算样式
  const finalBackgroundColor = isHighlighted 
    ? highlightBackgroundColor 
    : (propBackgroundColor ?? DEFAULT_CONFIG.backgroundColor);

  const spacingProps = {
    ...normalizeSpacing(margin, 'margin'),
    ...normalizeSpacing(padding, 'padding'),
  };

  // 2. 渲染内容
  const content = children ?? (title ? <Text color={textColor}>{title}</Text> : null);

  return (
    <Box
      // 先放默认/计算属性
      width={width}
      height={height}
      alignItems={alignItems}
      justifyContent={justifyContent}
      borderStyle={borderStyle}
      backgroundColor={finalBackgroundColor}
      {...spacingProps}
      // 后放 rest，允许外部显式覆盖上述任何行为 (典型的 React 模式)
      {...rest}
    >
      {content}
    </Box>
  );
};

export default MainInterface;
