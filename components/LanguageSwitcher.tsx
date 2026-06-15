"use client";

import { useTranslation } from "@/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  const toggle = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

  return (
    <button
      onClick={toggle}
      className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      {locale === "zh" ? "EN" : "中"}
    </button>
  );
}
