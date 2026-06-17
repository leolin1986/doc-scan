"use client";
import { useTranslation } from "@/i18n";

export default function GuidePage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-12 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("guide.title")}</h1>

      <div className="space-y-6 w-full">
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">1</div>
            <div>
              <h3 className="font-semibold mb-1">{t("guide.step1_title")}</h3>
              <p className="text-sm text-gray-600">{t("guide.step1_desc")}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">2</div>
            <div>
              <h3 className="font-semibold mb-1">{t("guide.step2_title")}</h3>
              <p className="text-sm text-gray-600">{t("guide.step2_desc")}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">3</div>
            <div>
              <h3 className="font-semibold mb-1">{t("guide.step3_title")}</h3>
              <p className="text-sm text-gray-600">{t("guide.step3_desc")}</p>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <h3 className="font-semibold mb-2">{t("guide.tips_title")}</h3>
          <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
            <li>{t("guide.tip1")}</li>
            <li>{t("guide.tip2")}</li>
            <li>{t("guide.tip3")}</li>
          </ul>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-2">{t("guide.manual_title")}</h3>
          <p className="text-sm text-gray-600">{t("guide.manual_desc")}</p>
        </div>
      </div>
    </div>
  );
}
