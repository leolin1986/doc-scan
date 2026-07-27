import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "扫立得 - 微信版",
  description: "拍照/选图，一键转扫描件",
};

export default function WechatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 极简顶部栏 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center shrink-0">
        <span className="text-lg font-bold text-gray-900">📄 扫立得</span>
      </header>
      {/* 主内容区 */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}