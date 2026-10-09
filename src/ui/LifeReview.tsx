import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useWindowSize } from "ink";
import { writeFileSync } from "node:fs";
import { useKeyboard } from "ink-cartridge";
import { useI18n } from "../core/language/LanguageContext.js";
import { resourcePath } from "../core/paths.js";
import { buildLifeReviewFromContainer } from "../game/lifeReviewContext.js";
import { ModalFrame, ScrollPanel } from "./kit/index.js";
import { statusViewHeight } from "./kit/viewport.js";
import { bar } from "./gameStatus/common.js";
import { dismissModal } from "./layers/modalBus.js";

const DIMS = ["career", "family", "health", "reputation", "karma", "world"] as const;

/**
 * The end-of-life review: a multi-dimensional summary plus a short biography,
 * exportable to `resource/life_review.txt`. Shown as a modal over the game-over
 * dialog.
 */
export default function LifeReview({ reason }: { reason?: "death" | "complete" }) {
  const { t } = useI18n();
  const { boundKeyboard } = useKeyboard();
  const review = useMemo(() => buildLifeReviewFromContainer(reason), [reason]);
  const [message, setMessage] = useState<string | null>(null);
  const { rows } = useWindowSize();
  const bioH = statusViewHeight(rows, { min: 3, max: 10, reserved: 12 });

  const close = () => dismissModal("life-review");

  const exportText = () => {
    const text = [
      t("review.title"),
      "",
      ...DIMS.map(
        (d) => `${t(`review.dim.${d}`)}: ${review.dimensions[d]}`,
      ),
      `${t("review.overall")}: ${review.overall} (${t(review.gradeKey)})`,
      "",
      ...review.lines.map((l) => t(l.key, l.params)),
    ].join("\n");
    try {
      writeFileSync(resourcePath("life_review.txt"), text, "utf-8");
      setMessage(t("review.exported", { path: "resource/life_review.txt" }));
    } catch {
      setMessage(t("review.exportFailed"));
    }
  };

  useEffect(() => {
    const uEsc = boundKeyboard(["escape"], () => close());
    const uExport = boundKeyboard(["e", "E"], () => exportText());
    return () => {
      uEsc();
      uExport();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundKeyboard, review]);

  const bioLines: React.ReactNode[] = review.lines.map((l) => (
    <Text key={l.key} color="white">
      {t(l.key, l.params)}
    </Text>
  ));

  return (
    <ModalFrame width={64} title={t("review.title")} borderColor="cyan" draggable>
      <Box flexDirection="column">
        <Text color="cyanBright">
          {t("review.overall")}: {review.overall} —{" "}
          <Text bold color="yellowBright">
            {t(review.gradeKey)}
          </Text>
        </Text>
        {DIMS.map((d) => (
          <Text key={d}>
            {t(`review.dim.${d}`).padEnd(12)} {bar(review.dimensions[d], 14)}{" "}
            {review.dimensions[d]}
          </Text>
        ))}

        <Box marginTop={1} flexDirection="column">
          <ScrollPanel height={bioH} lines={bioLines} showBar={bioLines.length > bioH} />
        </Box>

        {message ? (
          <Box marginTop={1}>
            <Text color="greenBright">{message}</Text>
          </Box>
        ) : null}

        <Box marginTop={1}>
          <Text dimColor>[Esc] {t("common.close")}   [E] {t("review.export")}</Text>
        </Box>
      </Box>
    </ModalFrame>
  );
}
