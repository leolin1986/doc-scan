import Link from "next/link";
import AdBanner from "@/components/AdBanner";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="w-full py-16 md:py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            一键把图片变成
            <span className="text-blue-600"> 干净扫描件 </span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto text-balance">
            上传照片或截图，自动边缘检测 + 透视校正 + 图像增强
            <br />
            3 种扫描模式，媲美扫描全能王
          </p>
          <Link
            href="/scan"
            className="btn-primary text-lg px-8 py-3 inline-block text-center"
          >
            立即开始扫描 →
          </Link>
          <p className="mt-4 text-sm text-gray-400">
            完全免费 · 浏览器端处理 · 不上传服务器
          </p>
        </div>
      </section>

      {/* Ad Banner */}
      <AdBanner size="large" />

      {/* Features */}
      <section className="w-full py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card text-center">
            <div className="text-3xl mb-3">📐</div>
            <h3 className="font-semibold mb-2">自动边缘检测</h3>
            <p className="text-sm text-gray-500">
              智能识别文档边缘，自动裁剪背景，只保留文档区域
            </p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">📏</div>
            <h3 className="font-semibold mb-2">透视校正</h3>
            <p className="text-sm text-gray-500">
              手机拍摄的倾斜文档自动拉正，恢复端正的扫描效果
            </p>
          </div>
          <div className="card text-center">
            <div className="text-3xl mb-3">🎨</div>
            <h3 className="font-semibold mb-2">3 种扫描模式</h3>
            <p className="text-sm text-gray-500">
              黑白文档 / 彩色清晰 / 去阴影增强，满足不同场景需求
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full py-12 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">三步搞定</h2>
          <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-3">
                1
              </div>
              <p className="text-sm font-medium">上传图片</p>
              <p className="text-xs text-gray-400 mt-1">拍照 / 截图 / 相册导入</p>
            </div>
            <div className="text-gray-300 text-2xl hidden md:block">→</div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-3">
                2
              </div>
              <p className="text-sm font-medium">自动处理</p>
              <p className="text-xs text-gray-400 mt-1">边缘检测 + 增强</p>
            </div>
            <div className="text-gray-300 text-2xl hidden md:block">→</div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-3">
                3
              </div>
              <p className="text-sm font-medium">下载扫描件</p>
              <p className="text-xs text-gray-400 mt-1">PNG / JPG / PDF</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ad Banner */}
      <AdBanner size="medium" />
    </div>
  );
}
