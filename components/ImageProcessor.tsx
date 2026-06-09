"use client";
import React, { useState, useRef, useCallback } from "react";
import {
  processImageWithCorners,
  detectDocumentCorners,
  ScanMode,
  ScanResult,
  ModeOption,
  CornerPoints,
} from "@/utils/imageProcess";
import CornerEditor from "./CornerEditor";

// 扫描模式定义
const SCAN_MODES: ModeOption[] = [
  { id: "bw", label: "黑白扫描", desc: "黑白文档效果", icon: "⬛" },
  { id: "color", label: "彩色清晰", desc: "保留色彩增强", icon: "🌈" },
  { id: "enhanced", label: "去阴影增强", desc: "去除阴影更清晰", icon: "✨" },
];

const MAX_IMAGES = 3;

export default function ImageProcessor() {
  const [images, setImages] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [processedImages, setProcessedImages] = useState<Record<number, ScanResult>>({});
  const [activeMode, setActiveMode] = useState<ScanMode>("bw");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasProcessed = selectedIndex in processedImages;

  // 手动编辑相关状态
  const [showEditor, setShowEditor] = useState(false);
  const [lastCorners, setLastCorners] = useState<CornerPoints | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ w: 0, h: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentImage = images[selectedIndex] || null;

  // 加载多张图片（异步批量）
  const loadImages = useCallback(async (files: File[]): Promise<string[]> => {
    const batches: string[] = [];
    for (const file of files) {
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      batches.push(url);
    }
    return batches;
  }, []);

  // 处理图片上传
  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length === 0) {
        alert("请上传图片文件");
        return;
      }

      const newUrls = await loadImages(files);

      setImages((prev) => {
        if (prev.length + newUrls.length > MAX_IMAGES) {
          alert(
            `最多上传 ${MAX_IMAGES} 张图片，已上传 ${prev.length} 张，还能上传 ${
              MAX_IMAGES - prev.length
            } 张`
          );
          return prev;
        }
        // 获取第一张新图的尺寸
        const img = new Image();
        img.onload = () =>
          setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = newUrls[0];
        // 选中第一张新图
        setSelectedIndex(prev.length);
        setLastCorners(null);
        return [...prev, ...newUrls];
      });
    },
    [loadImages]
  );

  // 拖放处理（支持多文件）
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  // 点击上传
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  // 切换选中的图片
  const handleSelectImage = (index: number) => {
    setSelectedIndex(index);
    setLastCorners(null);
    // 更新尺寸信息
    const img = new Image();
    img.onload = () =>
      setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = images[index];
  };

  // 删除某张图片
  const handleRemoveImage = (index: number) => {
    // 清理该图片的扫描结果
    setProcessedImages((prev) => {
      const next = { ...prev };
      const keys = Object.keys(next).map(Number);
      // 移除被删索引，并将之后的结果索引前移
      delete next[index];
      for (const k of keys) {
        if (k > index) {
          next[k - 1] = next[k];
          delete next[k];
        }
      }
      return next;
    });

    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setLastCorners(null);
        setShowEditor(false);
      } else {
        // 调整选中索引
        setSelectedIndex((sel) => {
          if (sel === index) return Math.min(0, next.length - 1);
          if (sel > index) return sel - 1;
          return sel;
        });
        setLastCorners(null);
        // 更新当前图片尺寸
        const newIdx = index === 0 ? 0 : Math.min(index - 1, next.length - 1);
        const img = new Image();
        img.onload = () =>
          setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = next[newIdx];
      }
      return next;
    });
  };

  // 打开手动角点编辑器（自动检测初始位置后打开）
  const handleSelectCorners = async () => {
    if (!currentImage || imageDimensions.w <= 0) return;
    setIsProcessing(true);
    try {
      const det = await detectDocumentCorners(currentImage);
      setLastCorners(det.corners);
      setImageDimensions({ w: det.width, h: det.height });
    } catch (err: any) {
      console.warn("自动检测失败，使用全图边界", err);
      alert("角点检测失败: " + (err?.message || err || "未知错误"));
      setLastCorners(null);
    } finally {
      setIsProcessing(false);
      setShowEditor(true);
    }
  };

  // 手动调整确认 → 用新角点重新处理
  const handleEditorConfirm = async (corners: CornerPoints) => {
    setShowEditor(false);
    if (!currentImage) return;

    setLastCorners(corners);
    setIsProcessing(true);
    try {
      const res = await processImageWithCorners(
        currentImage,
        corners,
        activeMode
      );
      setProcessedImages((prev) => ({ ...prev, [selectedIndex]: res }));
    } catch (err: any) {
      console.error("手动校正处理失败:", err);
      alert("处理失败: " + (err?.message || err || "未知错误"));
    } finally {
      setIsProcessing(false);
    }
  };

  // 打开手动编辑器
  const handleOpenEditor = () => {
    setShowEditor(true);
  };

  // 下载结果
  const handleDownload = () => {
    const r = processedImages[selectedIndex];
    if (!r) return;
    const link = document.createElement("a");
    link.download = `scanned_${Date.now()}.${r.format}`;
    link.href = r.dataUrl;
    link.click();
  };

  // 全部重置
  const handleReset = () => {
    setImages([]);
    setSelectedIndex(0);
    setProcessedImages({});
    setLastCorners(null);
    setShowEditor(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayedImage = processedImages[selectedIndex]?.dataUrl || currentImage || "";

  return (
    <div className="w-full max-w-4xl">
      {/* 模式选择 */}
      <div className="flex flex-wrap gap-2 mb-4 justify-center">
        {SCAN_MODES.map((mode) => (
          <button
            key={mode.id}
            className={`mode-btn ${activeMode === mode.id ? "active" : ""}`}
            onClick={() => setActiveMode(mode.id)}
          >
            <span className="mr-1">{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>

      {/* 上传区域 / 编辑区域 */}
      {images.length === 0 ? (
        <div
          className={`drop-zone rounded-2xl p-12 text-center cursor-pointer ${
            isDragOver ? "drag-over" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-5xl mb-4">📷</div>
          <p className="text-lg font-medium text-gray-700 mb-2">
            拖放图片到此处，或点击上传
          </p>
          <p className="text-sm text-gray-400">
            支持 JPG / PNG / WebP，一次最多 {MAX_IMAGES} 张
          </p>
        </div>
      ) : (
        <div className="card">
          {/* 图片预览 */}
          <div className="mb-4 relative">
            <div
              className="relative rounded-lg overflow-hidden bg-gray-100"
              style={{ maxHeight: "60vh" }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <img
                src={displayedImage}
                alt="预览"
                className="max-w-full max-h-[60vh] object-contain"
                style={{ display: "block" }}
              />
              {/* 关闭/删除按钮 */}
              <button
                onClick={() => handleRemoveImage(selectedIndex)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center text-lg transition-colors z-10"
                title="删除当前图片"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 缩略图条 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {images.map((src, i) => (
              <div key={i} className="relative">
                <button
                  onClick={() => handleSelectImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    i === selectedIndex
                      ? "border-violet-500 ring-2 ring-violet-300"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <img
                    src={src}
                    alt={`图片 ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(i);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-violet-400 text-gray-400 hover:text-violet-500 text-2xl flex items-center justify-center transition-colors"
                title="添加图片"
              >
                +
              </button>
            )}
          </div>

          {/* 底部操作栏 */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex gap-2">
              {!hasProcessed && (
                <button
                  className="btn-primary"
                  onClick={handleSelectCorners}
                >
                  {isProcessing ? "处理中..." : "🎯 手动选择端点"}
                </button>
              )}
              {hasProcessed && (
                <>
                  <button className="btn-primary" onClick={handleDownload}>
                    下载扫描件
                  </button>
                  <button className="btn-secondary" onClick={handleOpenEditor}>
                    ✋ 手动调整
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={handleReset}>
                重新上传
              </button>
              {hasProcessed && (
                <button
                  className="btn-secondary"
                  onClick={() =>
                    setProcessedImages((prev) => {
                      const next = { ...prev };
                      delete next[selectedIndex];
                      return next;
                    })
                  }
                >
                  查看原图
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 手动编辑器（模态） */}
      {showEditor && currentImage && imageDimensions.w > 0 && (
        <CornerEditor
          imageSrc={currentImage}
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
      {/* 隐藏的 file input，始终存在于 DOM */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
