import { readFileSync } from "fs";
import osLocale from "os-locale";
import { dirname, join } from "path";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { fileURLToPath } from "url";
import ConfigStore from "../store/ConfigStore.js";
import { container } from "../../Container.js";
import PluginHost from "../plugin/PluginHost.js";
import { isPluginEnabled } from "../plugin/sources.js";
import { resolveTranslation, type TranslationData } from "./translate.js";
import { installTranslator } from "./translator.js";


const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);



function initDefaultLanguage() {
  const local = osLocale()
  return local.replace('-', '_')
}



interface LanguageContextType {
  translations: TranslationData;
  modTranslations: TranslationData[]
  langCode: string;
  setLanguage: (code: string, data: TranslationData) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);


export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [translations, setTranslations] = useState<TranslationData>({});
  const [modTranslations, setModTranslations] = useState<TranslationData[]>([]);
  const [langCode, setLangCode] = useState<string>("");

  const loadLanguage = (code: string) => {
    // `code` comes from user-editable config.json: never let it contain path
    // separators or dots, or `${code}.json` could read any JSON file off disk.
    const safe = /^[A-Za-z0-9_-]+$/.test(code) ? code : 'zh_CN';
    try {
      const dir = join(_dirname, '..', '..', '..', 'resource', 'language')
      const filePath = join(dir, `${safe}.json`)
      const content = JSON.parse(readFileSync(filePath, 'utf-8'))

      setLangCode(safe)
      setTranslations(content)
    } catch (err) {
      console.warn('No language packs found for your region, start default Chinese language pack')
      if (safe !== 'zh_CN') loadLanguage('zh_CN')
    }
  }

  /**
   * Every enabled plugin's own language pack, in load order.
   *
   * Driven by the plugin host rather than by the mod folder alone, so a plugin
   * the game ships has the same right to localise itself as a user mod: it puts
   * `language/<code>.json` next to its code and the strings arrive here.
   */
  const loadPluginLanguages = (code: string): TranslationData[] => {
    try {
      const host = container.resolve(PluginHost);
      const enablement = host.enablement();
      const result: TranslationData[] = [];

      for (const ref of host.discover()) {
        if (!isPluginEnabled(ref, enablement)) continue;
        try {
          const content = JSON.parse(
            readFileSync(join(ref.dir, "language", `${code}.json`), "utf-8"),
          );
          result.push(content);
        } catch {
          // no language file for this code — skip it
        }
      }
      return result;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const configStore = container.resolve(ConfigStore);
    const savedLang = configStore.getLanguage();
    let code: string;
    if (savedLang) {
      code = savedLang;
    } else {
      code = initDefaultLanguage();
    }
    loadLanguage(code); // 加载基础翻译
    setModTranslations(loadPluginLanguages(code)); // 加载mod翻译
  }, []);

  const setLanguage = (code: string, data: TranslationData) => {
    setLangCode(code);
    setTranslations(data);
    setModTranslations(loadPluginLanguages(code));
  };


  // Non-React code (plugin hooks, console commands) translates through the
  // module-level holder; the provider is its only writer.
  useEffect(() => {
    installTranslator((key, params) =>
      resolveTranslation({ translations, langCode, modTranslations }, key, params),
    );
  }, [translations, langCode, modTranslations]);

  return (
    <LanguageContext.Provider value={{ translations, langCode, setLanguage, modTranslations }}>
      {children}
    </LanguageContext.Provider>
  );
};


export const useI18n = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useI18n must be used within LanguageProvider");

  // One resolver for the hook and for the module-level translator plugins use,
  // so a key can never resolve differently depending on who asks.
  const t = (key: string, params?: Record<string, string | number>) =>
    resolveTranslation(context, key, params);

  return { t, ...context };
};
