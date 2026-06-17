"use client";
import { useTranslation } from "@/i18n";

interface LoadingOverlayProps {
  phase: "init" | "detect" | "process";
}

export default function LoadingOverlay({ phase }: LoadingOverlayProps) {
  const { t } = useTranslation();

  const messages = {
    init: t("loading.initializing"),
    detect: t("loading.detecting"),
    process: t("loading.processing_result"),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
        <svg
          className="animate-spin h-10 w-10 text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-gray-700 font-medium text-lg">{messages[phase]}</p>
      </div>
    </div>
  );
}
