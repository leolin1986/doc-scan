"use client";
import React, { useState, useRef, useCallback } from "react";
import {
  detectDocumentCorners,
  processImageWithCorners,
  type ScanMode,
  type ScanResult,
  type CornerPoints,
} from "@/utils/imageProcess";
import WechatCornerEditor from "./WechatCornerEditor";
import LoadingOverlay from "./LoadingOverlay";

const SCAN_MODES: { id: ScanMode; label: string; icon: string }[] = [
  { id: "enhanced", label: "去阴影增强", icon: "✨" },
  { id: "bw", label: "黑白扫描", icon: "⬛" },
  { id: "color", label: "彩色清晰", icon: "🌈" },
];

export default function WechatScanner() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<ScanMode>("enhanced");
  const [phase, setPhase] = useState<"idle" | "init" | "detect" | "process">("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [lastCorners, setLastCorners] = useState<CornerPoints | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ w: 0, h: 0 });
  const [showResult, setShowResult] = useState(false);
  const imageSrcRef = useRef<string | null>(null);
  imageSrcRef.current = imageSrc;

  // 加载图片
  const loadImage = useCallback((dataUrl: string) => {
    setImageSrc(dataUrl);
    setResult(null);
    setLastCorners(null);
    setShowResult(false);
    const img = new Image();
    img.onload = () => setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = dataUrl;
  }, []);

  // 拍照（使用 capture 唤起系统相机）
  const handleCamera = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  }, [loadImage]);

  // 从相册选择
  const handleGallery = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  }, [loadImage]);

  // 检测文档边界
  const handleDetect = async () => {
    if (!imageSrc) return;
    setPhase("init");
    try {
      const det = await detectDocumentCorners(imageSrc);
      setLastCorners(det.corners);
      if (det.corners) {
        setImageDimensions({ w: det.width, h: det.height });
        setPhase("idle");
        setShowEditor(true);
      } else {
        // 没检测到角点，直接全图处理
        setPhase("process");
        const fullCorners: CornerPoints = [
          { x: 0, y: 0 },
          { x: det.width - 1, y: 0 },
          { x: det.width - 1, y: det.height - 1 },
          { x: 0, y: det.height - 1 },
        ];
        const res = await processImageWithCorners(imageSrc, fullCorners, activeMode);
        setResult(res);
        setShowResult(true);
        setPhase("idle");
      }
    } catch (err: any) {
      alert("检测失败: " + (err?.message || err));
    } finally {
      setPhase("idle");
    }
  };

  // 角点编辑确认 → 处理
  const handleEditorConfirm = async (corners: CornerPoints) => {
    setShowEditor(false);
    const capturedSrc = imageSrcRef.current;
    if (!capturedSrc) return;
    setPhase("process");
    try {
      const res = await processImageWithCorners(capturedSrc, corners, activeMode);
      setResult(res);
      setShowResult(true);
    } catch (err: any) {
      alert("处理失败: " + (err?.message || err));
    } finally {
      setPhase("idle");
    }
  };

  // 下载
  const handleDownload = () => {
    if (!result) return;
    // 尝试标准下载
    try {
      const link = document.createElement("a");
      link.download = `scanned_${Date.now()}.${result.format}`;
      link.href = result.dataUrl;
      link.click();
    } catch {
        // WeChat browser blocks download links via click(); silently swallow
      }
  };

  // 重新上传
  const handleReset = () => {
    setImageSrc(null);
    setResult(null);
    setLastCorners(null);
    setShowEditor(false);
    setShowResult(false);
    setPhase("idle");
  };

  // 初始状态（无图）
  if (!imageSrc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="text-6xl mb-6">📄</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">扫立得</h2>
        <p className="text-sm text-gray-400 mb-8 text-center">拍照或选图，一键转扫描件</p>
        <div className="w-full max-w-xs space-y-4">
          <button
            className="w-full py-4 rounded-xl text-lg font-medium text-white bg-blue-600 active:bg-blue-700 transition-colors shadow-sm"
            onClick={handleCamera}
          >
            📷 拍照
          </button>
          <button
            className="w-full py-4 rounded-xl text-lg font-medium text-gray-700 bg-white border border-gray-300 active:bg-gray-50 transition-colors"
            onClick={handleGallery}
          >
            🖼 从相册选择
          </button>
        </div>
        <p className="mt-6 text-xs text-gray-400">支持 JPG / PNG / WebP</p>
      </div>
    );
  }

  // 结果展示模态
  if (showResult && result) {
    return (
      <div className="flex-1 flex flex-col">
        {/* 大图预览 */}
        <div className="flex-1 flex items-center justify-center p-4 bg-gray-900">
          <img
            src={result.dataUrl}
            alt="扫描结果"
            className="max-w-full max-h-full object-contain shadow-lg"
          />
        </div>
        {/* 底部操作 */}
        <div className="bg-white px-4 py-4 border-t border-gray-200 space-y-3">
          <p className="text-center text-sm text-gray-500">
            👆 长按图片保存到手机
          </p>
          <div className="flex gap-3">
            <button
              className="flex-1 py-3 rounded-xl text-base font-medium text-gray-600 bg-gray-100 active:bg-gray-200 transition-colors"
              onClick={handleReset}
            >
              重新上传
            </button>
            <button
              className="flex-1 py-3 rounded-xl text-base font-medium text-white bg-blue-600 active:bg-blue-700 transition-colors"
              onClick={handleDownload}
            >
              下载
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 有图状态（未处理/可编辑）
  return (
    <div className="flex-1 flex flex-col">
      {/* 图片预览区 */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-100">
        <img
          src={imageSrc}
          alt="预览"
          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
        />
      </div>

      {/* 底部操作栏 */}
      <div className="bg-white px-4 py-4 border-t border-gray-200 space-y-3">
        {/* 模式选择 */}
        <div className="flex gap-2">
          {SCAN_MODES.map((mode) => (
            <button
              key={mode.id}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                activeMode === mode.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 active:bg-gray-200"
              }`}
              onClick={() => setActiveMode(mode.id)}
              disabled={phase !== "idle"}
            >
              <span className="mr-1">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            className="flex-1 py-3 rounded-xl text-base font-medium text-gray-600 bg-gray-100 active:bg-gray-200 transition-colors"
            onClick={handleReset}
          >
            重新选择
          </button>
          <button
            className="flex-1 py-3 rounded-xl text-base font-medium text-white bg-blue-600 active:bg-blue-700 transition-colors shadow-sm"
            onClick={handleDetect}
            disabled={phase !== "idle"}
          >
            {phase !== "idle" ? "处理中..." : "🎯 检测文档边界"}
          </button>
        </div>
      </div>

      {/* 角点编辑器 */}
      {showEditor && imageSrc && imageDimensions.w > 0 && (
        <WechatCornerEditor
          imageSrc={imageSrc}
          imageWidth={imageDimensions.w}
          imageHeight={imageDimensions.h}
          initialCorners={
            lastCorners || [
              { x: 0, y: 0 },
              { x: imageDimensions.w - 1, y: 0 },
              { x: imageDimensions.w - 1, y: imageDimensions.h - 1 },
              { x: 0, y: imageDimensions.h - 1 },
            ]
          }
          onConfirm={handleEditorConfirm}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* Loading 遮罩 */}
      {(phase === "init" || phase === "detect" || phase === "process") && (
        <LoadingOverlay phase={phase} />
      )}
    </div>
  );
}