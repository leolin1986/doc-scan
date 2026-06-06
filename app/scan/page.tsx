"use client";
import Image from "next/image";
import ImageProcessor from "@/components/ImageProcessor";

export default function ScanPage() {
  return (
    <div className="flex flex-col items-center px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">文档扫描</h1>
        <p className="text-sm text-gray-500">
          上传图片，自动转扫描件效果
        </p>
      </div>

      {/* Ad Banner - Top */}
      <div className="w-full max-w-4xl mb-4">
        <div className="h-16 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">
          📢 广告位 (728×90)
        </div>
      </div>

      <ImageProcessor />

      <div className="w-full max-w-4xl mt-6">
        <div className="h-16 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400">
          📢 广告位 (728×90)
        </div>
      </div>
    </div>
  );
}
