import React from "react";
import { Box, BoxProps, Text } from "ink";
import SelectInput from "ink-select-input";
import { useLanguageScreen } from "../hooks/useLanguageScreen.js";

interface LanguageBoxProps extends BoxProps {
  label: string;
  isSelected?: boolean;
  highlightColor: string;
}

const LanguageBox = ({ label, isSelected, highlightColor }: LanguageBoxProps) => (
  <Box width="100%" height={3} borderStyle="double"
    borderColor={isSelected ? highlightColor : "blue"}>
    <Box justifyContent="center" width="100%">
      <Text color={isSelected ? highlightColor : "white"}>{label}</Text>
    </Box>
  </Box>
);

export default function Language() {
  const data = useLanguageScreen();

  return (
    <Box flexDirection="column" padding={1} width="100%" height={data.rows}>
      <Box justifyContent="center">
        <Text color="red">{data.t('language.title', { language: data.currentLangCode })}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <SelectInput
          items={data.items}
          onSelect={data.onSelectLanguage as any}
          itemComponent={LanguageBox as any}
        />
      </Box>
    </Box>
  );
}