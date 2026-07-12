# 用户反馈功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating feedback button + form modal to the DocScan web app, submit via API route + Resend email.

**Architecture:** React components (FeedbackButton + FeedbackModal) in the existing components/ directory, a Next.js App Router API route at app/api/feedback/route.ts, i18n keys extended in existing zh.json/en.json.

**Tech Stack:** Next.js 14 (App Router), React 18, TailwindCSS, Resend SDK, TypeScript 5

## Global Constraints

- Only render feedback button on web version (use `process.env.CAPACITOR_BUILD !== "true"` in layout.tsx)
- All components are "use client" — they rely on useState/useEffect
- i18n keys follow existing flat JSON pattern in i18n/zh.json and i18n/en.json
- Modal styling follows PrivacyPolicyDialog pattern (fixed inset-0 z-50, bg-black/50 overlay, bg-white rounded-xl, max-w-md)
- No external icon libraries — use Unicode stars (★/☆) for rating
- Form fields: rating (1-5 required), category (bug|feature|other), message (required), email (optional)
- API returns JSON: `{ success: true }` | `{ error: "message" }`
- Feedback email recipient: `blackboy007pp@hotmail.com` (from env var `FEEDBACK_EMAIL`)

---

### Task 1: Install Resend + Add i18n Keys

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `i18n/zh.json` (append feedback keys)
- Modify: `i18n/en.json` (append feedback keys)

**Interfaces:**
- Produces: `package.json` updated with `resend` dependency; zh.json/en.json updated with 12 new feedback keys

- [ ] **Step 1: Install Resend SDK**

Run: `npm install resend`

Expected: `"resend": "^4.0.0"` (or latest) in package.json dependencies

- [ ] **Step 2: Add feedback keys to zh.json**

Append to `i18n/zh.json`:

```json
  "feedback.button": "反馈",
  "feedback.rating_label": "评分",
  "feedback.category_label": "分类",
  "feedback.category_bug": "Bug 报告",
  "feedback.category_feature": "功能建议",
  "feedback.category_other": "其他留言",
  "feedback.message_placeholder": "请描述您的意见或遇到的问题...",
  "feedback.email_placeholder": "选填：邮箱（方便我们回复您）",
  "feedback.submit": "提交反馈",
  "feedback.submitting": "提交中...",
  "feedback.success": "感谢您的反馈！",
  "feedback.error": "提交失败，请稍后重试",
  "feedback.rating_required": "请选择评分",
  "feedback.message_required": "请输入留言内容"
```

Note: add a trailing comma to the previous last key ("about.web_version") before appending. Verify valid JSON.

- [ ] **Step 3: Add feedback keys to en.json**

Append to `i18n/en.json`:

```json
  "feedback.button": "Feedback",
  "feedback.rating_label": "Rating",
  "feedback.category_label": "Category",
  "feedback.category_bug": "Bug Report",
  "feedback.category_feature": "Feature Suggestion",
  "feedback.category_other": "Other",
  "feedback.message_placeholder": "Describe your feedback or issue...",
  "feedback.email_placeholder": "Optional: Email (for us to reply)",
  "feedback.submit": "Submit Feedback",
  "feedback.submitting": "Submitting...",
  "feedback.success": "Thank you for your feedback!",
  "feedback.error": "Submission failed, please try again",
  "feedback.rating_required": "Please select a rating",
  "feedback.message_required": "Please enter your message"
```

- [ ] **Step 4: Verify JSON validity**

Run: `node -e "const zh = require('./i18n/zh.json'), en = require('./i18n/en.json'); console.log('zh keys:', Object.keys(zh).length, 'en keys:', Object.keys(en).length)"`

Expected: prints key counts (zh: ~135, en: ~135), no parse error.

- [ ] **Step 5: Commit**

```bash
git add package.json i18n/zh.json i18n/en.json
git commit -m "feat: add resend dependency and feedback i18n keys"
```

---

### Task 2: Create API Route (app/api/feedback/route.ts)

**Files:**
- Create: `app/api/feedback/route.ts`

**Interfaces:**
- Consumes: `RESEND_API_KEY` and `FEEDBACK_EMAIL` environment variables
- Produces: `POST /api/feedback` endpoint accepting `{ rating, category, message, email?, url? }` and returning `{ success: true }` or `{ error: string }` with appropriate status codes

- [ ] **Step 1: Create API route directory and file**

Create `app/api/feedback/route.ts` with the following content:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug 报告",
  feature: "功能建议",
  other: "其他留言",
};

interface FeedbackBody {
  rating: number;
  category: string;
  message: string;
  email?: string;
  url?: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackBody = await request.json();

    // Validation
    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return NextResponse.json({ error: "评分必须在 1-5 之间" }, { status: 400 });
    }
    if (!["bug", "feature", "other"].includes(body.category)) {
      return NextResponse.json({ error: "无效的分类" }, { status: 400 });
    }
    if (!body.message || body.message.trim().length === 0) {
      return NextResponse.json({ error: "留言内容不能为空" }, { status: 400 });
    }

    const stars = "⭐".repeat(body.rating);
    const categoryLabel = CATEGORY_LABELS[body.category] || body.category;
    const pageUrl = body.url || "(unknown)";
    const timestamp = body.timestamp || new Date().toISOString();
    const formattedTime = new Date(timestamp).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">📬 用户反馈</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">评分</td>
              <td style="padding:8px 12px;">${stars} (${body.rating}/5)</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">分类</td>
              <td style="padding:8px 12px;">${categoryLabel}</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">页面</td>
              <td style="padding:8px 12px;">${pageUrl}</td></tr>
          <tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">时间</td>
              <td style="padding:8px 12px;">${formattedTime}</td></tr>
          ${body.email ? `<tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">邮箱</td><td style="padding:8px 12px;">${body.email}</td></tr>` : ""}
        </table>
        <div style="border-top:1px solid #eee;padding-top:16px;margin-top:16px;white-space:pre-wrap;">
          <strong>留言内容：</strong><br>${body.message}
        </div>
      </div>
    `;

    if (resend) {
      await resend.emails.send({
        from: "DocScan Feedback <onboarding@resend.dev>",
        to: process.env.FEEDBACK_EMAIL || "blackboy007pp@hotmail.com",
        subject: `[DocScan 反馈] ${categoryLabel} - ${body.rating}/5`,
        html: emailHtml,
      });
    } else {
      // Dev fallback: log to console
      console.log("=== FEEDBACK (no RESEND_API_KEY) ===", {
        rating: body.rating,
        category: body.category,
        message: body.message,
        email: body.email,
        url: pageUrl,
        timestamp: formattedTime,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "发送失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit --strict app/api/feedback/route.ts 2>&1 | head -20` or just do a quick syntax check.

Run: `node -e "require('fs').readFileSync('app/api/feedback/route.ts','utf8');console.log('OK')"` to confirm file exists.

- [ ] **Step 3: Commit**

```bash
git add app/api/feedback/route.ts
git commit -m "feat: add feedback API route with Resend integration"
```

---

### Task 3: Create FeedbackModal Component

**Files:**
- Create: `components/FeedbackModal.tsx`

**Interfaces:**
- Consumes: `useTranslation()` hook from `@/i18n` (returns `{ t, locale }`)
- Consumes: `POST /api/feedback` endpoint
- Produces: `<FeedbackModal onClose={() => void} />` component with four states: `idle | submitting | success | error`

- [ ] **Step 1: Create FeedbackModal.tsx**

Create `components/FeedbackModal.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
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
  const modalRef = useRef<HTMLDivElement>(null);

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
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
      >
        {/* Success state */}
        {status === "success" ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <span className="text-3xl">✓</span>
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
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --strict components/FeedbackModal.tsx 2>&1 | head -20`

Expected: No type errors (or only errors about path aliases, which are resolved at build time).

- [ ] **Step 3: Commit**

```bash
git add components/FeedbackModal.tsx
git commit -m "feat: add FeedbackModal component with form validation"
```

---

### Task 4: Create FeedbackButton Component

**Files:**
- Create: `components/FeedbackButton.tsx`

**Interfaces:**
- Consumes: `useTranslation()` hook from `@/i18n`
- Consumes: `<FeedbackModal />` component
- Produces: `<FeedbackButton />` — a floating button that toggles FeedbackModal

- [ ] **Step 1: Create FeedbackButton.tsx**

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit --strict components/FeedbackButton.tsx 2>&1 | head -20`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add components/FeedbackButton.tsx
git commit -m "feat: add FeedbackButton floating button component"
```

---

### Task 5: Wire into Layout + Verify Build

**Files:**
- Modify: `app/layout.tsx` (import and render FeedbackButton for web version only)

**Interfaces:**
- Consumes: `<FeedbackButton />` component
- Renders: FeedbackButton inside `<I18nProvider>` but outside `<main>`, using `process.env.CAPACITOR_BUILD !== "true"` guard

- [ ] **Step 1: Update layout.tsx**

Add FeedbackButton import and render it for web version:

```typescript
// Add to existing imports:
import FeedbackButton from "@/components/FeedbackButton";

// Add inside <I18nProvider>, after </main> but before <Footer />:
          {!isCapacitor && <FeedbackButton />}
```

The relevant section of layout.tsx should look like:

```tsx
          <main className="flex-1">{children}</main>
          {!isCapacitor && <FeedbackButton />}
          <Footer />
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: Build succeeds with no errors. The feedback components are tree-shaken for Capacitor builds because `process.env.CAPACITOR_BUILD` is a build-time constant.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: wire FeedbackButton into layout (web only)"
```

---

### Task 6: Deploy & Configure Env Vars

**Files:** (Vercel dashboard, not code)

- [ ] **Step 1: Sign up for Resend**

Go to https://resend.com → sign up → verify your domain or use the default `onboarding@resend.dev` sender (limited to sending to verified emails on free plan).

- [ ] **Step 2: Get Resend API Key**

Generate an API key from Resend dashboard. It starts with `re_`.

- [ ] **Step 3: Add Vercel environment variables**

In Vercel project dashboard → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | `re_xxxxxxxx` |
| `FEEDBACK_EMAIL` | `blackboy007pp@hotmail.com` |

Add to Production and Preview environments.

- [ ] **Step 4: Redeploy**

Push to GitHub → Vercel auto-deploys. Or trigger manual redeploy from Vercel dashboard.

- [ ] **Step 5: Verify end-to-end**

Open https://scanfree.tech → click "反馈" button in bottom-right → fill form → submit → check email inbox for the feedback email.

---

## Self-Review

- Spec coverage: All spec requirements covered — floating button, one-page form with rating/category/message/email, API validation, Resend email, i18n, error states, success auto-close, web-only rendering.
- Placeholder scan: No TBD/TODO/placeholders. All code is concrete.
- Type consistency: `Category` type used consistently across components. API request/response shapes match between FeedbackModal fetch and route.ts handler.