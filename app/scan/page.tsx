"use client";
import ImageProcessor from "@/components/ImageProcessor";
import AdBanner from "@/components/AdBanner";
import { useTranslation } from "@/i18n";

const isCapacitor = process.env.CAPACITOR_BUILD === "true";

export default function ScanPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-24">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">{t("scan.title")}</h1>
        <p className="text-sm text-gray-500">
          {t("scan.subtitle")}
        </p>
      </div>

      {!isCapacitor && (
        <div className="w-full max-w-4xl mb-4">
          <AdBanner />
        </div>
      )}

      <ImageProcessor />

      {!isCapacitor && (
        <div className="w-full max-w-4xl mt-6">
          <AdBanner />
        </div>
      )}
    </div>
  );
}
