import React from "react";
import { Box, Text, Newline } from "ink";
import Level from "../level/Level.js";
import { FormattedCondition } from "../hooks/useLevelSelection.js";
import { useTerminalSize } from "./TerminalSizeContext.js";

export interface LevelDetailProps {
    level: Level;
    formattedConditions: FormattedCondition[];
    initialAttributes: Record<string, string | number>;
    t: (key: string, params?: Record<string, string | number>) => string;
    onBack: () => void;
    onConfirm: () => void;
}

/** 属性名列表（按显示顺序） */
const ATTRIBUTE_ORDER: { key: string; category: string }[] = [
    { key: "playerName", category: "basic" },
    { key: "age", category: "physical" },
    { key: "health", category: "physical" },
    { key: "height", category: "physical" },
    { key: "weight", category: "physical" },
    { key: "angerValue", category: "psychological" },
    { key: "excitationValue", category: "psychological" },
    { key: "depressionValue", category: "psychological" },
    { key: "weakValue", category: "psychological" },
    { key: "fortune", category: "wealth" },
];

const CATEGORY_NAMES: Record<string, string> = {
    basic: "playerConfig.category.basic",
    physical: "playerConfig.category.physical",
    psychological: "playerConfig.category.psychological",
    wealth: "playerConfig.category.wealth",
};

export default function LevelDetail({
    level,
    formattedConditions,
    initialAttributes,
    t
}: LevelDetailProps) {
    const { rows } = useTerminalSize();

    // 按分类组织属性
    const categorizedAttrs = new Map<string, Array<{ key: string; value: string | number }>>();
    for (const { key, category } of ATTRIBUTE_ORDER) {
        if (key in initialAttributes) {
            if (!categorizedAttrs.has(category)) {
                categorizedAttrs.set(category, []);
            }
            categorizedAttrs.get(category)!.push({
                key,
                value: initialAttributes[key],
            });
        }
    }

    return (
        <Box flexDirection="column" width="100%" height={rows - 4} padding={1}>
            {/* 标题 */}
            <Box justifyContent="center" marginBottom={1}>
                <Text color="yellow" bold>
                    {t("levelDetail.title")}: {t(level.nameKey)}
                </Text>
            </Box>

            {/* 描述 */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold color="cyan">
                    {t("levelDetail.description")}
                </Text>
                <Text>{t(level.descriptionKey)}</Text>
            </Box>

            {/* 难度 */}
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    {t("levelDetail.difficulty")}:{" "}
                </Text>
                <Text color="magenta">{t(`difficulty.${level.difficultyIdentification}`)}</Text>
            </Box>

            {/* 胜利条件 */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold color="cyan">
                    {t("levelDetail.victoryConditions")}
                </Text>
                {formattedConditions.length === 0 ? (
                    <Text color="gray" dimColor>
                        {"  "}{t("levelDetail.noConditions")}
                    </Text>
                ) : (
                    formattedConditions.map((cond, i) => (
                        <Text key={i} color={cond.isCustom ? "gray" : "white"}>
                            {"  "}• {cond.description}
                            {cond.isCustom ? ` (${t("levelDetail.custom")})` : ""}
                        </Text>
                    ))
                )}
            </Box>

            {/* 初始属性 */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold color="cyan">
                    {t("levelDetail.initialAttributes")}
                </Text>
                {Array.from(categorizedAttrs.entries()).map(([category, attrs]) => (
                    <Box key={category} flexDirection="column" marginLeft={2}>
                        <Text dimColor>
                            {t(CATEGORY_NAMES[category] || category)}:
                        </Text>
                        {attrs.map(({ key, value }) => (
                            <Text key={key} >
                                {t(`playerConfig.attr.${key}`)}:{" "}
                                <Text color="green">{String(value)}</Text>
                            </Text>
                        ))}
                    </Box>
                ))}
            </Box>

            <Newline />

            {/* 操作提示 */}
            <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
                <Box>
                    <Text color="green" bold>
                        [Enter]{" "}
                    </Text>
                    <Text dimColor>{t("levelDetail.enterHint")}</Text>
                </Box>
                <Box>
                    <Text color="yellow" bold>
                        [Esc]{" "}
                    </Text>
                    <Text dimColor>{t("levelDetail.escHint")}</Text>
                </Box>
            </Box>
        </Box>
    );
}
