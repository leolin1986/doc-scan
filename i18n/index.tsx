"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import zh from "./zh.json";
import en from "./en.json";

export type Locale = "zh" | "en";

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Locale, Record<string, string>> = { zh, en };

const LOCALE_KEY = "docscan_locale";
const COOKIE_KEY = "NEXT_LOCALE";
const DEFAULT_LOCALE: Locale = "zh";

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 始终用 DEFAULT_LOCALE 初始化，保证 SSR 与客户端首帧一致，避免 hydration mismatch
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    // 客户端挂载后从 localStorage 读取用户偏好
    let detected: Locale = DEFAULT_LOCALE;
    try {
      const saved = localStorage.getItem(LOCALE_KEY);
      if (saved === "zh" || saved === "en") {
        detected = saved;
      } else {
        detected = navigator.language.startsWith("zh") ? "zh" : "en";
        localStorage.setItem(LOCALE_KEY, detected);
      }
    } catch {}
    setLocaleState(detected);
    document.documentElement.lang = detected === "zh" ? "zh-CN" : "en";
    document.title = translations[detected]["meta.title"] || translations["zh"]["meta.title"];
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_KEY, newLocale);
    document.cookie = `${COOKIE_KEY}=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.lang = newLocale === "zh" ? "zh-CN" : "en";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = translations[locale]["meta.title"] || translations["zh"]["meta.title"];
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = translations[locale] || translations[DEFAULT_LOCALE];
      let text = dict[key] || translations[DEFAULT_LOCALE][key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return text;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string) => key,
    };
  }
  return ctx;
}
