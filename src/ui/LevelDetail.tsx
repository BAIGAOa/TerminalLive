import React, { useEffect } from "react";
import { Box, Text, Newline } from "ink";
import { useKeyboard } from "ink-cartridge";
import Level from "../level/Level.js";
import { FormattedCondition } from "../hooks/useLevelSelection.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { Button } from "./kit/index.js";

export interface LevelDetailProps {
  level: Level;
  formattedConditions: FormattedCondition[];
  initialAttributes: Record<string, string | number>;
  t: (key: string, params?: Record<string, string | number>) => string;
  onBack: () => void;
  onConfirm: () => void;
}

const ATTRIBUTE_ORDER: { key: string; category: string }[] = [
  { key: "playerName", category: "basic" },
  { key: "age", category: "physical" },
  { key: "health", category: "physical" },
  { key: "height", category: "physical" },
  { key: "weight", category: "physical" },
  { key: "intelligence", category: "skills" },
  { key: "social", category: "skills" },
  { key: "fitness", category: "skills" },
  { key: "happiness", category: "skills" },
  { key: "angerValue", category: "psychological" },
  { key: "excitationValue", category: "psychological" },
  { key: "depressionValue", category: "psychological" },
  { key: "weakValue", category: "psychological" },
  { key: "money", category: "wealth" },
];

const CATEGORY_NAMES: Record<string, string> = {
  basic: "playerConfig.category.basic",
  physical: "playerConfig.category.physical",
  skills: "playerConfig.category.skills",
  psychological: "playerConfig.category.psychological",
  wealth: "playerConfig.category.wealth",
};

export default function LevelDetail({
  level,
  formattedConditions,
  initialAttributes,
  t,
  onBack,
  onConfirm,
}: LevelDetailProps) {
  const { rows } = useTerminalSize();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    const uEnter = boundKeyboard(["return"], () => onConfirm());
    const uEsc = boundKeyboard(["escape"], () => onBack());
    return () => {
      uEnter();
      uEsc();
    };
  }, [boundKeyboard, onConfirm, onBack]);

  const categorizedAttrs = new Map<
    string,
    Array<{ key: string; value: string | number }>
  >();
  for (const { key, category } of ATTRIBUTE_ORDER) {
    if (key in initialAttributes) {
      if (!categorizedAttrs.has(category)) categorizedAttrs.set(category, []);
      categorizedAttrs.get(category)!.push({ key, value: initialAttributes[key] });
    }
  }

  return (
    <Box flexDirection="column" width="100%" height={rows - 4} padding={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {t("levelDetail.title")}: {t(level.nameKey)}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={colors.info}>
          {t("levelDetail.description")}
        </Text>
        <Text>{t(level.descriptionKey)}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold color={colors.info}>
          {t("levelDetail.difficulty")}:{" "}
        </Text>
        <Text color="magenta">{t(`difficulty.${level.difficultyIdentification}`)}</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={colors.info}>
          {t("levelDetail.victoryConditions")}
        </Text>
        {formattedConditions.length === 0 ? (
          <Text color={colors.muted} dimColor>
            {"  "}
            {t("levelDetail.noConditions")}
          </Text>
        ) : (
          formattedConditions.map((cond, i) => (
            <Text key={i} color={cond.isCustom ? colors.muted : colors.text}>
              {"  "}• {cond.description}
              {cond.isCustom ? ` (${t("levelDetail.custom")})` : ""}
            </Text>
          ))
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={colors.info}>
          {t("levelDetail.initialAttributes")}
        </Text>
        {Array.from(categorizedAttrs.entries()).map(([category, attrs]) => (
          <Box key={category} flexDirection="column" marginLeft={2}>
            <Text dimColor>{t(CATEGORY_NAMES[category] || category)}:</Text>
            {attrs.map(({ key, value }) => (
              <Text key={key}>
                {t(`playerConfig.attr.${key}`)}:{" "}
                <Text color={colors.success}>{String(value)}</Text>
              </Text>
            ))}
          </Box>
        ))}
      </Box>

      <Newline />

      <Box flexDirection="row" gap={1}>
        <Button label={`${t("levelDetail.enterHint")}`} onPress={onConfirm} />
        <Button label={`${t("levelDetail.escHint")}`} onPress={onBack} color="yellow" />
      </Box>
    </Box>
  );
}
