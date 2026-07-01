"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";

const STORAGE_KEY = "privacy_agreed";

export default function PrivacyPolicyDialog() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  const handleAgree = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const handleReject = async () => {
    localStorage.removeItem(STORAGE_KEY);
    try {
      const { App } = await import("@capacitor/app");
      App.exitApp();
    } catch {
      // Web 环境无法退出，弹窗保持显示
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-[90%] p-6">
        <h2 className="text-lg font-bold mb-3">{t("privacy.title")}</h2>
        <p className="text-sm text-gray-600 mb-4">{t("privacy.intro")}</p>

        <Link
          href="/privacy"
          className="text-sm text-blue-600 underline mb-4 inline-block"
        >
          {t("privacy.link")}
        </Link>

        <label className="flex items-start gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-sm text-gray-700">{t("privacy.agree")}</span>
        </label>

        <button
          onClick={handleAgree}
          disabled={!checked}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium text-sm
                     disabled:opacity-40 disabled:cursor-not-allowed
                     hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          {t("privacy.confirm")}
        </button>

        <button
          onClick={handleReject}
          className="w-full py-3 mt-2 rounded-lg text-gray-500 font-medium text-sm
                     hover:text-gray-700 transition-colors"
        >
          {t("privacy.reject")}
        </button>
      </div>
    </div>
  );
}
