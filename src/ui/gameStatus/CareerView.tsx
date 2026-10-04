import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import CareerSystem from "../../world/careers/CareerSystem.js";
import { bar, StatusScroll } from "./common.js";

const SKILLS = ["craft", "lead", "network", "finance"] as const;
const FACTIONS = ["peers", "bosses", "rivals"] as const;

/** The player's work life: track/rank/salary, plus performance, skills,
 *  office politics, certifications and any self-run venture. */
export default function CareerView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const careers = container.resolve(CareerSystem);
  const state = careers.getState(player);
  const work = careers.getWork();
  const hasWork =
    work.certs.length > 0 ||
    work.venture !== null ||
    Object.values(work.skills).some((v) => v > 0);

  if (!state && !hasWork) {
    return (
      <StatusScroll
        height={height}
        lines={[
          <Text dimColor>{t("career.none")}</Text>,
          <Text dimColor>{t("career.none.hint")}</Text>,
        ]}
      />
    );
  }

  const lines: React.ReactNode[] = [];

  if (state) {
    const { career, rank, rankDef, salary, next } = state;
    lines.push(
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="yellow">
          {t(career.labelKey)}
        </Text>
        <Text color="cyan">
          {t("career.rankOf", { rank: rank + 1, max: career.ranks.length })}
        </Text>
      </Box>,
      <Box flexDirection="row">
        <Text>{t("career.rank")}: </Text>
        <Text bold color="greenBright">
          {t(rankDef.titleKey)}
        </Text>
        <Text>   </Text>
        <Text color="yellow">
          ${salary}
          <Text dimColor>{t("career.perYear")}</Text>
        </Text>
      </Box>,
      null,
    );

    if (next) {
      lines.push(
        <Text color="white">
          {t("career.next", { title: t(next.rankDef.titleKey) })}
        </Text>,
      );
      next.rankDef.requires.forEach((req) => {
        const value =
          req.npc !== undefined
            ? player.getRelationship(req.npc)
            : req.prop !== undefined
              ? player.getStat(req.prop)
              : 0;
        const need = req.gte ?? req.lte ?? 0;
        const met =
          (req.gte === undefined || value >= req.gte) &&
          (req.lte === undefined || value <= req.lte);
        const propName = req.prop
          ? t(`playerConfig.attr.${req.prop}`)
          : t("career.requirement");
        lines.push(
          <Text color={met ? "green" : "gray"}>
            {"  "}
            {met ? "✓" : "○"} {propName} {value}/{need}
          </Text>,
        );
      });
    } else {
      lines.push(<Text color="greenBright">{t("career.max")}</Text>);
    }
  }

  // ── work dynamics ──
  lines.push(
    null,
    <Text dimColor>── {t("career.work")} ──</Text>,
    <Text>
      {t("career.work.performance")} <Text color="green">{bar(work.performance, 12)}</Text>
    </Text>,
    <Text>
      {t("career.work.burnout")}{" "}
      <Text color={work.burnout > 70 ? "red" : "yellow"}>{bar(work.burnout, 12)}</Text>
    </Text>,
  );

  const skillLine = SKILLS.map(
    (id) => `${t(`career.skill.${id}`)} ${work.skills[id] ?? 0}`,
  ).join("  ");
  lines.push(<Text color="cyan">{skillLine}</Text>);

  if (work.certs.length > 0) {
    lines.push(
      <Text color="magenta">
        {t("career.certs")}: {work.certs.map((c) => t(`career.cert.${c}`)).join(", ")}
      </Text>,
    );
  }

  const politics = FACTIONS.map((id) => {
    const v = work.standing[id] ?? 0;
    return `${t(`career.standing.${id}`)} ${v > 0 ? "+" : ""}${Math.round(v)}`;
  }).join("  ");
  lines.push(<Text dimColor>{t("career.politics")}: {politics}</Text>);

  if (work.venture) {
    const v = work.venture;
    lines.push(
      null,
      <Text dimColor>── {t("career.venture")} ──</Text>,
      <Text color="yellowBright">{t(`career.industry.${v.industry}`)}</Text>,
      <Text>
        {t("career.venture.product")} {bar(v.product, 12)}  {"  "}
        {t("career.venture.staff")}: {v.staff}
      </Text>,
      <Text color={v.capital <= 0 ? "red" : "green"}>
        {t("career.venture.capital")}: ${v.capital}  {"  "}
        {t("career.venture.revenue")}: ${v.revenue}
      </Text>,
    );
  }

  return <StatusScroll height={height} lines={lines} />;
}
