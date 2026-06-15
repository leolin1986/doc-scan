"use client";

import Link from "next/link";
import AdBanner from "@/components/AdBanner";
import { useTranslation } from "@/i18n";

const isCapacitor = process.env.CAPACITOR_BUILD === "true";

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="w-full py-16 md:py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {t("hero.title_prefix")}
            <span className="text-blue-600"> {t("hero.title_highlight")} </span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto text-balance">
            {t("hero.subtitle")}
            <br />
            {t("hero.subtitle2")}
          </p>
          <Link
            href="/scan"
            className="btn-primary text-lg px-8 py-3 inline-block text-center"
          >
            {t("hero.cta")}
          </Link>
          <p className="mt-4 text-sm text-gray-400">
            {t("hero.note")}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="w-full py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card text-center">
            <div className="text-3xl mb-3">📐</div>
            <h3 className="font-semibold mb-2">{t("features.auto_crop_title")}</h3>
            <p className="text-sm text-gray-500">
              {t("features.auto_crop_desc")}
            </p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">📏</div>
            <h3 className="font-semibold mb-2">{t("features.perspective_title")}</h3>
            <p className="text-sm text-gray-500">
              {t("features.perspective_desc")}
            </p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="font-semibold mb-2">{t("features.modes_title")}</h3>
            <p className="text-sm text-gray-500">
              {t("features.modes_desc")}
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">{t("howto.title")}</h2>
          <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-3">
                1
              </div>
              <p className="text-sm font-medium">{t("howto.step1_title")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("howto.step1_desc")}</p>
            </div>
            <div className="text-gray-300 text-2xl hidden md:block">→</div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-3">
                2
              </div>
              <p className="text-sm font-medium">{t("howto.step2_title")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("howto.step2_desc")}</p>
            </div>
            <div className="text-gray-300 text-2xl hidden md:block">→</div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-3">
                3
              </div>
              <p className="text-sm font-medium">{t("howto.step3_title")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("howto.step3_desc")}</p>
            </div>
          </div>
        </div>
      </section>

      {!isCapacitor && <AdBanner />}
    </div>
  );
}
