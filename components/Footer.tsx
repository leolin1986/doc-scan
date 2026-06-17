"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
      <div className="max-w-6xl mx-auto px-4">
        <p>{t("footer.copyright")}</p>
        <p className="mt-1">{t("footer.features")}</p>
        <p className="mt-2">
          <Link href="/privacy" className="hover:text-blue-600 transition-colors">
            {t("footer.privacy")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
