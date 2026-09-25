import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { loadLS, saveLS } from "@/lib/prefs"
import zhCN from "./zh-CN.json"
import en from "./en.json"

export const LANGS = ["zh-CN", "en"] as const
export type Lang = (typeof LANGS)[number]

const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
}

export function initLang(): Lang {
  const saved = loadLS<string>("lang", "")
  const lang = (LANGS as readonly string[]).includes(saved)
    ? (saved as Lang)
    : navigator.language.toLowerCase().startsWith("zh")
      ? "zh-CN"
      : "en"
  return lang
}

export function setLang(lang: Lang) {
  saveLS("lang", lang)
  i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})
