import React, { ReactNode } from "react";
import { Box, Text, BoxProps } from "ink";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

type Size = number | string;

type SpacingValue =
  | number
  | { top?: number; bottom?: number; left?: number; right?: number };

export interface MainInterfaceProps
  extends Omit<BoxProps, "margin" | "padding" | "width" | "height"> {
  margin?: SpacingValue;
  padding?: SpacingValue;
  width?: Size;
  height?: Size;
  isHighlighted?: boolean;
  title?: string;
  textColor?: string;
  children?: ReactNode;
}

const DEFAULT_CONFIG = {
  width: "100%" as Size,
  height: "100%" as Size,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  textColor: "white",
  backgroundColor: "black",
  isHighlighted: false,
  borderStyle: "bold" as BoxProps["borderStyle"],
  margin: 4 as SpacingValue,
  padding: 1 as SpacingValue,
};

function normalizeSpacing(
  value: SpacingValue | undefined,
  prefix: "margin" | "padding",
): BoxProps {
  if (value === undefined) return {};
  if (typeof value === "number") {
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

const MainInterface: React.FC<MainInterfaceProps> = (props) => {
  const colors = useThemeColors();

  const {
    width = DEFAULT_CONFIG.width,
    height = DEFAULT_CONFIG.height,
    alignItems = DEFAULT_CONFIG.alignItems,
    justifyContent = DEFAULT_CONFIG.justifyContent,
    borderStyle = DEFAULT_CONFIG.borderStyle,
    backgroundColor: propBackgroundColor,
    isHighlighted = DEFAULT_CONFIG.isHighlighted,
    textColor = DEFAULT_CONFIG.textColor,
    margin = DEFAULT_CONFIG.margin,
    padding = DEFAULT_CONFIG.padding,
    title,
    children,
    ...rest
  } = props;

  const finalBackgroundColor = isHighlighted
    ? colors.highlightBackground
    : propBackgroundColor ?? colors.background;

  const spacingProps = {
    ...normalizeSpacing(margin, "margin"),
    ...normalizeSpacing(padding, "padding"),
  };

  const content =
    children ?? (title ? <Text color={textColor}>{title}</Text> : null);

  return (
    <Box
      width={width}
      height={height}
      alignItems={alignItems}
      justifyContent={justifyContent}
      borderStyle={borderStyle}
      backgroundColor={finalBackgroundColor}
      {...spacingProps}
      {...rest}
    >
      {content}
    </Box>
  );
};

export default MainInterface;