"use client";
import { useTranslation } from "@/i18n";

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-12 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("about.title")}</h1>

      <div className="space-y-6 w-full">
        <div className="card text-center">
          <div className="text-5xl mb-3">📄</div>
          <h2 className="text-xl font-bold mb-1">DocScan</h2>
          <p className="text-sm text-gray-500">{t("about.version", { version: "1.0.0" })}</p>
          <p className="text-sm text-gray-600 mt-3">{t("about.description")}</p>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-2">{t("about.features_title")}</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>{t("about.feat1")}</li>
            <li>{t("about.feat2")}</li>
            <li>{t("about.feat3")}</li>
            <li>{t("about.feat4")}</li>
          </ul>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-2">{t("about.privacy_title")}</h3>
          <p className="text-sm text-gray-600">{t("about.privacy_desc")}</p>
        </div>
      </div>
    </div>
  );
}
