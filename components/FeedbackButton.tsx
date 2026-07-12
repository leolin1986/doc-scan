"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 px-4 py-2.5 rounded-full
                   bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg
                   text-sm font-medium text-gray-700
                   hover:bg-white hover:shadow-xl hover:text-blue-600
                   active:scale-95
                   transition-all duration-200"
      >
        {t("feedback.button")}
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}