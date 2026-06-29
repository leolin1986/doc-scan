import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivacyPolicyDialog from "@/components/PrivacyPolicyDialog";
import AnalyticsScript from "./AnalyticsScript";
import { I18nProvider } from "@/i18n";
import zh from "@/i18n/zh.json";

const isCapacitor = process.env.CAPACITOR_BUILD === "true";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

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
        <link rel="prefetch" href="/opencv/opencv.js" />
      </head>
      <body className="min-h-screen flex flex-col">
        <I18nProvider>
          <PrivacyPolicyDialog />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          {!isCapacitor && <AnalyticsScript />}
        </I18nProvider>
      </body>
    </html>
  );
}
