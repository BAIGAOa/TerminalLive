import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import ConfigStore from "../core/store/ConfigStore.js";
import type Player from "../world/Player.js";
import type { CareerDefinition } from "../world/careers/CareerDefinition.js";
import {
  applicantBrief,
  interviewMessages,
  jobBrief,
  parseVerdict,
  pitchTooShort,
  type Verdict,
} from "../world/careers/interview.js";
import { deepseekChat } from "../core/ai/deepseek.js";
import { TextArea } from "./kit/index.js";

type Phase = "pitch" | "waiting" | "verdict";

/** A refusal, as an i18n key plus its params. */
export interface InterviewRefusal {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * The AI written test.
 *
 * The player writes a pitch, the whole player state and the vacancy go to
 * DeepSeek, and an interviewer decides. Only reachable when a key is
 * configured — without one the board hires straight off the entry gates.
 */
export default function CareerInterview({
  player,
  def,
  checkAttempt,
  onAttempt,
  onPass,
  onCancel,
}: {
  player: Player;
  def: CareerDefinition;
  /** Cheap affordability check, run before spending a request. */
  checkAttempt: () => InterviewRefusal | null;
  /** Charge the attempt. Returns false when it could not be charged. */
  onAttempt: () => boolean;
  /** The interviewer said yes — the caller takes the job. */
  onPass: () => void;
  /** Back to the job's page, whether the player gave up or was rejected. */
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  const [phase, setPhase] = useState<Phase>("pitch");
  const [pitch, setPitch] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A reply that lands after the player has left must not touch state.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const submit = async () => {
    if (phase !== "pitch" || pitchTooShort(pitch)) return;

    // Check affordability before spending a request; charge only once an answer
    // actually came back, so a network failure never costs the player a turn.
    const refusal = checkAttempt();
    if (refusal) {
      setError(t(refusal.key, refusal.params));
      return;
    }

    setError(null);
    setPhase("waiting");

    const key = container.resolve(ConfigStore).getDeepseekApiKey();
    const messages = interviewMessages(
      applicantBrief(player),
      jobBrief(player, def, t),
      pitch,
      def.id,
    );
    const result = await deepseekChat(key, messages);
    if (!aliveRef.current) return;

    if (!result.ok) {
      setError(t(`ai.err.${result.kind}`) + (result.status ? ` (${result.status})` : ""));
      setPhase("pitch");
      return;
    }
    if (!onAttempt()) {
      setError(t("careerBoard.action.blocked"));
      setPhase("pitch");
      return;
    }
    setVerdict(parseVerdict(result.text));
    setPhase("verdict");
  };

  // Enter accepts a passing verdict; while typing, the TextArea owns Enter (it
  // inserts a newline) and Ctrl+S submits. Esc always backs out.
  useEffect(() => {
    const unbinds = [boundKeyboard(["escape"], onCancel)];
    if (phase === "verdict") {
      unbinds.push(
        boundKeyboard(["return"], () => {
          if (verdict?.pass) onPass();
        }),
      );
    }
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, phase, verdict, onCancel]);

  const short = pitchTooShort(pitch);

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color={colors.info}>
          {t("interview.title", { job: t(def.labelKey) })}
        </Text>
        <Text dimColor>{t("interview.interviewer")}</Text>
      </Box>

      {phase === "pitch" ? (
        <>
          <Box marginTop={1}>
            <Text wrap="wrap" color={colors.text}>
              {t("interview.brief")}
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="row">
            <Text color={colors.info}>{"› "}</Text>
            <TextArea
              value={pitch}
              onChange={setPitch}
              onSubmit={() => void submit()}
              focusId="interview-pitch"
              placeholder={t("interview.placeholder")}
              width={62}
              height={4}
            />
          </Box>
          {error ? (
            <Box marginTop={1}>
              <Text color={colors.danger} wrap="wrap">
                {error}
              </Text>
            </Box>
          ) : null}
          <Box marginTop={1} flexDirection="column">
            {short ? <Text color={colors.muted}>{t("interview.tooShort")}</Text> : null}
            <Text dimColor>{t("interview.hint")}</Text>
          </Box>
        </>
      ) : null}

      {phase === "waiting" ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.warning}>{t("interview.waiting")}</Text>
          <Text dimColor>{t("interview.waiting.hint")}</Text>
        </Box>
      ) : null}

      {phase === "verdict" && verdict ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold color={verdict.pass ? colors.success : colors.danger}>
            {verdict.pass ? t("interview.pass") : t("interview.fail")}{" "}
            <Text dimColor>{t("interview.score", { score: verdict.score })}</Text>
          </Text>
          <Box marginTop={1}>
            <Text wrap="wrap" color={colors.text}>
              {verdict.comment}
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              {verdict.pass ? t("interview.hint.accept") : t("interview.hint.retry")}
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
