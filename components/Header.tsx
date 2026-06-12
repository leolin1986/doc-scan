"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header() {
  const { t } = useTranslation();

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <span className="font-bold text-lg text-gray-900">DocScan</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/scan" className="text-gray-600 hover:text-blue-600 transition-colors">
            {t("nav.scan")}
          </Link>
          <Link href="#" className="text-gray-600 hover:text-blue-600 transition-colors">
            {t("nav.guide")}
          </Link>
          <Link href="#" className="text-gray-600 hover:text-blue-600 transition-colors">
            {t("nav.about")}
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
