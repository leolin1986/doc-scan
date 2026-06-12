import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/react";
import { I18nProvider } from "@/i18n";
import zh from "@/i18n/zh.json";
import en from "@/i18n/en.json";

const allTranslations = { zh, en } as const;

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "zh";
  const t = allTranslations[locale];

  return {
    title: t["meta.title"],
    description: t["meta.description"],
    keywords: t["meta.keywords"],
    openGraph: {
      title: t["meta.og_title"],
      description: t["meta.og_description"],
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "zh";
  const langAttr = locale === "zh" ? "zh-CN" : "en";

  return (
    <html lang={langAttr}>
      <head>
        {/* 广告通过 AdBanner 组件加载（AADS） */}
      </head>
      <body className="min-h-screen flex flex-col">
        <I18nProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <Analytics />
        </I18nProvider>
      </body>
    </html>
  );
}
