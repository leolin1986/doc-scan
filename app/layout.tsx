import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "在线图片转扫描件 | DocScan - 免费文档扫描工具",
  description:
    "免费在线图片转扫描件工具，自动边缘检测、透视校正、图像增强。支持黑白扫描、彩色扫描、去阴影模式。",
  keywords:
    "图片转扫描件,在线扫描,文档扫描,图片增强,边缘检测,透视校正,免费扫描工具",
  openGraph: {
    title: "DocScan - 免费在线文档扫描工具",
    description: "拍照/上传图片，一键转扫描件效果",
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
        {/* 广告通过 AdBanner 组件加载（AADS） */}
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
          <div className="max-w-6xl mx-auto px-4">
            <p>© 2026 DocScan. 免费在线文档扫描工具</p>
            <p className="mt-1">
              支持：黑白扫描 · 彩色清晰 · 去阴影增强 · PDF 导出
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
