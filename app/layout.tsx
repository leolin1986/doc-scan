import type { Metadata, Viewport } from "next";
import "./globals.css";
import BackButtonHandler from "@/components/BackButtonHandler";
import DesktopLayoutShell from "@/components/DesktopLayoutShell";
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
          <BackButtonHandler />
          <DesktopLayoutShell>{children}</DesktopLayoutShell>
        </I18nProvider>
      </body>
    </html>
  );
}
