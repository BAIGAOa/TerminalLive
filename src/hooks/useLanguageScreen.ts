import { useMemo, useCallback } from "react";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { container } from "../Container.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

export interface LanguageScreenData {
  items: Array<{ label: string; value: string; highlightColor: string }>;
  currentLangCode: string;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectLanguage: (item: { value: string }) => void;
}

export function useLanguageScreen(): LanguageScreenData {
  const { t, langCode, setLanguage } = useI18n();
  const { rows } = useTerminalSize();

  const items = useMemo(() => {
    const dir = join(_dirname, "..", "..", "resource", "language");
    const filesName = readdirSync(dir).filter((name) => name.endsWith(".json"));
    return filesName.map((name) => {
      const content = JSON.parse(readFileSync(join(dir, name), "utf-8"));
      return {
        value: name,
        label: content.label ?? parse(name).name,
        highlightColor: "green" as const,
      };
    });
  }, []);

  const onSelectLanguage = useCallback(
    (item: { value: string }) => {
      const dir = join(_dirname, "..", "..", "resource", "language");
      const filePath = join(dir, item.value);
      try {
        const content = JSON.parse(readFileSync(filePath, "utf-8"));
        const code = parse(item.value).name;
        setLanguage(code, content);
        container
          .resolve(ConfigStore)
          .setLanguage(code)
          .catch((err) => console.error("语言持久化失败:", err));
      } catch (err) {
        console.error("语言切换失败:", err);
      }
    },
    [setLanguage],
  );

  return {
    items,
    currentLangCode: langCode,
    rows,
    t,
    onSelectLanguage,
  };
}
