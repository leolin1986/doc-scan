"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";

type Category = "bug" | "feature" | "other";
type Status = "idle" | "submitting" | "success" | "error";

export default function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<Category>("other");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ratingError, setRatingError] = useState(false);
  const [messageError, setMessageError] = useState(false);

  // Auto-close after success
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && status !== "submitting") {
      onClose();
    }
  };

  const handleSubmit = async () => {
    // Validate
    let valid = true;
    if (rating === 0) {
      setRatingError(true);
      valid = false;
    } else {
      setRatingError(false);
    }
    if (!message.trim()) {
      setMessageError(true);
      valid = false;
    } else {
      setMessageError(false);
    }
    if (!valid) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          category,
          message: message.trim(),
          email: email.trim() || undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "提交失败");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : t("feedback.error"));
    }
  };

  const categories: { value: Category; labelKey: string }[] = [
    { value: "bug", labelKey: "feedback.category_bug" },
    { value: "feature", labelKey: "feedback.category_feature" },
    { value: "other", labelKey: "feedback.category_other" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        {/* Success state */}
        {status === "success" ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <span className="text-3xl text-green-600">✓</span>
            </div>
            <p className="text-lg font-semibold text-gray-800">{t("feedback.success")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {t("feedback.button")}
              </h2>
              <button
                onClick={onClose}
                disabled={status === "submitting"}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40 text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Rating */}
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t("feedback.rating_label")}
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => { setRating(star); setRatingError(false); }}
                    className={`text-3xl transition-colors ${
                      star <= rating
                        ? "text-yellow-400"
                        : "text-gray-200 hover:text-yellow-300"
                    } ${status === "submitting" ? "cursor-not-allowed" : "cursor-pointer"}`}
                    disabled={status === "submitting"}
                  >
                    {star <= rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              {ratingError && (
                <p className="text-xs text-red-500 mt-1">{t("feedback.rating_required")}</p>
              )}
            </div>

            {/* Category */}
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {t("feedback.category_label")}
              </p>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    disabled={status === "submitting"}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      category === cat.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                    } ${status === "submitting" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {t(cat.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="mb-4">
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); setMessageError(false); }}
                placeholder={t("feedback.message_placeholder")}
                disabled={status === "submitting"}
                rows={4}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:cursor-not-allowed ${
                  messageError ? "border-red-400" : "border-gray-300"
                }`}
              />
              {messageError && (
                <p className="text-xs text-red-500 mt-1">{t("feedback.message_required")}</p>
              )}
            </div>

            {/* Email (optional) */}
            <div className="mb-5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("feedback.email_placeholder")}
                disabled={status === "submitting"}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Error message */}
            {status === "error" && errorMsg && (
              <p className="text-sm text-red-500 mb-3">{errorMsg}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={status === "submitting"}
              className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "submitting" ? t("feedback.submitting") : t("feedback.submit")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}