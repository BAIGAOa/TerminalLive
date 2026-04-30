import { readFileSync } from "fs";
import osLocale from "os-locale";
import { dirname, join } from "path";
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { fileURLToPath } from "url";
import ConfigStore from "../store/ConfigStore.js";
import { container } from "../../Container.js";
import ModRegistry from "../mod/ModRegistry.js";


const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);



function initDefaultLanguage() {
  const local = osLocale()
  return local.replace('-', '_')
}


type TranslationData = Record<string, string>;

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
    try {
      const dir = join(_dirname, '..', '..', '..', 'resource', 'language')
      const filePath = join(dir, `${code}.json`)
      const content = JSON.parse(readFileSync(filePath, 'utf-8'))

      setLangCode(code)
      setTranslations(content)
    } catch (err) {
      console.warn('No language packs found for your region, start default Chinese language pack')
      if (code !== 'zh_CN') loadLanguage('zh_CN')
    }
  }

  const loadModLanguages = (code: string): TranslationData[] => {
    try {
      const configStore = container.resolve(ConfigStore);
      const modRegistry = container.resolve(ModRegistry);
      const enabledMods = configStore.getEnabledMods();
      const result: TranslationData[] = [];

      for (const modName of enabledMods) {
        const langPath = join(
          modRegistry.getModLanguagePath(modName),
          `${code}.json`,
        );
        try {
          const content = JSON.parse(readFileSync(langPath, "utf-8"));
          result.push(content);
        } catch {
          //没有这个语言文件，直接跳过
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
    setModTranslations(loadModLanguages(code)); // 加载mod翻译
  }, []);

  const setLanguage = (code: string, data: TranslationData) => {
    setLangCode(code);
    setTranslations(data);
    setModTranslations(loadModLanguages(code));
  };


  return (
    <LanguageContext.Provider value={{ translations, langCode, setLanguage, modTranslations }}>
      {children}
    </LanguageContext.Provider>
  );
};


export const useI18n = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useI18n must be used within LanguageProvider");

  const t = (key: string, params?: Record<string, string | number>) => {
    let text: string | undefined = context.translations[key];

    if (text === undefined) {
      for (const modTrans of context.modTranslations) {
        text = modTrans[key];
        if (text !== undefined) break;
      }
    }

    if (text === undefined) {
      text = key;
    }

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text!.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }

    return text
  };

  return { t, ...context };
};
