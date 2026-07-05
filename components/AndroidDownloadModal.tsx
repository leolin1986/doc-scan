"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n";

const isCapacitor = process.env.CAPACITOR_BUILD === "true";
const APP_STORE_URL = "https://appgallery.huawei.com/app/C118098205";

export default function AndroidDownloadModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsNative(!!(window as any).Capacitor?.isNativePlatform);
  }, []);

  if (isCapacitor || isNative || !mounted) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-gray-600 hover:text-green-600 transition-colors py-1.5 px-2 md:py-2.5 min-h-[44px] md:min-h-0 flex items-center text-sm"
      >
        {t("nav.download_app")}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t("android_promo.title")}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors shrink-0 -mr-1 -mt-1"
                  aria-label={t("android_promo.dismiss")}
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-500 text-center mb-5">
                {t("android_promo.subtitle")}
              </p>

              <div className="flex justify-center mb-5">
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                  <img
                    src="/qr-download.png"
                    alt="QR Code"
                    className="w-52 h-52 rounded-xl"
                  />
                </a>
              </div>

              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors mb-4"
              >
                {t("android_promo.download")}
              </a>

              <p className="text-xs text-gray-400 text-center leading-relaxed">
                {t("android_promo.non_huawei_note")}
              </p>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-500 hover:text-blue-600 text-center break-all"
              >
                {APP_STORE_URL}
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}