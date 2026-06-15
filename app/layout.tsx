import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnalyticsScript from "./AnalyticsScript";
import { I18nProvider } from "@/i18n";
import zh from "@/i18n/zh.json";

const isCapacitor = process.env.CAPACITOR_BUILD === "true";

export const metadata: Metadata = {
  title: zh["meta.title"],
  description: zh["meta.description"],
  keywords: zh["meta.keywords"],
  openGraph: {
    title: zh["meta.og_title"],
    description: zh["meta.og_description"],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-screen flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <I18nProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          {!isCapacitor && <AnalyticsScript />}
        </I18nProvider>
      </body>
    </html>
  );
}
