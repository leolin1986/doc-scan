"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import AndroidDownloadModal from "./AndroidDownloadModal";

export default function Header() {
  const { t } = useTranslation();

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <span className="font-bold text-lg text-gray-900">DocScan</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/scan" className="text-gray-600 hover:text-blue-600 transition-colors py-1.5 px-2 md:py-2.5 min-h-[44px] md:min-h-0 flex items-center">
            {t("nav.scan")}
          </Link>
          <Link href="/guide" className="text-gray-600 hover:text-blue-600 transition-colors py-1.5 px-2 md:py-2.5 min-h-[44px] md:min-h-0 flex items-center">
            {t("nav.guide")}
          </Link>
          <Link href="/about" className="text-gray-600 hover:text-blue-600 transition-colors py-1.5 px-2 md:py-2.5 min-h-[44px] md:min-h-0 flex items-center">
            {t("nav.about")}
          </Link>
          <AndroidDownloadModal />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
