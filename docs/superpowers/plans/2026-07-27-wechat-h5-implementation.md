# 扫立得 H5 手机版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Next.js 项目的新增 `/wechat/` 路由下，创建一套触屏优化的 H5 扫描页面，通过微信公众号二维码扫码访问

**架构:** 新增 `/wechat` 路由组 + 2 个新组件（WechatScanner、WechatCornerEditor），共享现有 `@/utils/imageProcess` 核心处理逻辑。桌面版零改动。

**Tech Stack:** Next.js 14 App Router, React 18, TailwindCSS, Canvas API (OpenCV.js)

## 全局约束

- 仅中文，不依赖 i18n 系统，文案直接硬编码
- 无广告、无页脚、无语言切换、无隐私弹窗
- 单张图片处理，不支持多图片管理
- 所有按钮触屏尺寸 ≥ 48px
- 微信内置浏览器适配：`<a download>` 不可靠，用大图预览 + 长按保存提示 + canvas.toBlob 双保险

---

### Task 1: 创建 `/wechat/layout.tsx`

**Files:**
- Create: `app/wechat/layout.tsx`

**Interfaces:**
- Consumes: 无
- Produces: 极简 H5 布局，无 Header/Footer/广告/语言切换/隐私弹窗/反馈按钮

- [ ] **Step 1: 创建 wechat 布局文件**

```tsx
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
```

- [ ] **Step 2: 验证构建通过**

```bash
cd /d/code/doc-scan && npx next build 2>&1 | tail -5
```
Expected: 构建成功，无报错

---

### Task 2: 创建触屏版角点编辑器 `WechatCornerEditor.tsx`

**Files:**
- Create: `components/WechatCornerEditor.tsx`

**Interfaces:**
- Consumes: `CornerPoints` 来自 `@/utils/imageProcess`
- Produces: `WechatCornerEditor` 组件
  - Props: `{ imageSrc: string; imageWidth: number; imageHeight: number; initialCorners: CornerPoints; onConfirm: (corners: CornerPoints) => void; onCancel: () => void }`
  - 触屏优化：拖拽手柄 44px+，双指缩放，全屏模态

该组件基于现有 `CornerEditor.tsx` 的代码结构，差异点：
- 全屏覆盖，无圆角卡片容器，直接用 `fixed inset-0`
- 顶部栏仅显示标题 + 缩放比例，去掉副标题文字
- 底部操作栏按钮更大（py-3），间距更宽
- 所有文案硬编码中文，不调 `useTranslation`
- 移除 `isDesktop` 判断，始终用触屏尺寸（touchSize=44, handleRadius=16）
- 移除滚轮缩放逻辑（桌面端相关）

- [ ] **Step 1: 创建 WechatCornerEditor.tsx**

```tsx
"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Point, CornerPoints } from "@/utils/imageProcess";

interface WechatCornerEditorProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  initialCorners: CornerPoints;
  onConfirm: (corners: CornerPoints) => void;
  onCancel: () => void;
}

export default function WechatCornerEditor({
  imageSrc,
  imageWidth,
  imageHeight,
  initialCorners,
  onConfirm,
  onCancel,
}: WechatCornerEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState<CornerPoints>(initialCorners);
  const [dragIdx, setDragIdx] = useState<number>(-1);
  const [imgLayout, setImgLayout] = useState({ x: 0, y: 0, w: 1, h: 1, scale: 1 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef({
    initialDist: 0, initialZoom: 1,
    initialPanX: 0, initialPanY: 0,
    centerX: 0, centerY: 0,
  });

  // 计算图片在容器中的实际显示位置（object-contain 等效）
  const updateLayout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    const imgAspect = imageWidth / imageHeight;
    const containerAspect = cw / ch;
    let x = 0, y = 0, dw = 0, dh = 0;
    if (imgAspect > containerAspect) {
      dw = cw;
      dh = cw / imgAspect;
      y = (ch - dh) / 2;
    } else {
      dh = ch;
      dw = ch * imgAspect;
      x = (cw - dw) / 2;
    }
    setImgLayout({ x, y, w: dw, h: dh, scale: dw / imageWidth });
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [updateLayout]);

  // DOM 坐标 → 图像坐标
  const domToImage = useCallback(
    (cx: number, cy: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const px = (cx - rect.left - imgLayout.x - pan.x) / (imgLayout.scale * zoom);
      const py = (cy - rect.top - imgLayout.y - pan.y) / (imgLayout.scale * zoom);
      return {
        x: Math.max(0, Math.min(imageWidth, px)),
        y: Math.max(0, Math.min(imageHeight, py)),
      };
    },
    [imgLayout, imageWidth, imageHeight, zoom, pan]
  );

  // 拖拽角点（鼠标）
  useEffect(() => {
    if (dragIdx < 0) return;
    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const pt = domToImage(e.clientX, e.clientY);
      setCorners((prev) => {
        const next = [...prev] as CornerPoints;
        next[dragIdx] = pt;
        return next;
      });
    };
    const onMouseUp = () => setDragIdx(-1);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragIdx, domToImage]);

  // 拖拽角点（触屏）
  useEffect(() => {
    if (dragIdx < 0) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragIdx >= 0) {
        const t = e.touches[0];
        const pt = domToImage(t.clientX, t.clientY);
        setCorners((prev) => {
          const next = [...prev] as CornerPoints;
          next[dragIdx] = pt;
          return next;
        });
      }
    };
    const onTouchEnd = () => setDragIdx(-1);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [dragIdx, domToImage]);

  // 双指缩放
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const getDist = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && dragIdx < 0) {
        e.preventDefault();
        const d = getDist(e.touches[0], e.touches[1]);
        const c = getCenter(e.touches[0], e.touches[1]);
        pinchRef.current = {
          initialDist: d, initialZoom: zoomRef.current,
          initialPanX: panRef.current.x, initialPanY: panRef.current.y,
          centerX: c.x, centerY: c.y,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && dragIdx < 0) {
        e.preventDefault();
        const d = getDist(e.touches[0], e.touches[1]);
        if (d === 0) return;
        const c = getCenter(e.touches[0], e.touches[1]);
        const { initialDist, initialZoom, initialPanX, initialPanY, centerX, centerY } = pinchRef.current;
        const newZoom = Math.max(1, Math.min(5, initialZoom * (d / initialDist)));
        const newPanX = initialPanX + (c.x - centerX);
        const newPanY = initialPanY + (c.y - centerY);
        zoomRef.current = newZoom;
        panRef.current = { x: newPanX, y: newPanY };
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [dragIdx]);

  // 图像坐标 → 显示坐标
  const imgToDom = (p: Point) => ({
    x: p.x * imgLayout.scale * zoom + imgLayout.x + pan.x,
    y: p.y * imgLayout.scale * zoom + imgLayout.y + pan.y,
  });

  const isOutOfBounds = (p: Point) =>
    p.x < 0 || p.x > imageWidth || p.y < 0 || p.y > imageHeight;

  const touchSize = 44;
  const handleRadius = 16;
  const colors = ["#00bcd4", "#e91e63", "#ff9800", "#4caf50"];
  const labels = ["TL", "TR", "BR", "BL"];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-5 py-3 bg-white shrink-0">
        <h3 className="text-lg font-semibold text-gray-800">调整文档边界</h3>
        <button
          className="text-sm font-medium text-gray-500 px-3 py-1.5 rounded-lg bg-gray-100"
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }}
        >
          🔍 {zoom > 1 ? `${Math.round(zoom * 100)}%` : "重置"}
        </button>
      </div>

      {/* 图片编辑区 */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-gray-100 overflow-hidden"
        style={{ cursor: dragIdx >= 0 ? "grabbing" : "default", touchAction: "none" }}
      >
        <img
          src={imageSrc}
          alt="原图"
          className="w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: `${imgLayout.x}px ${imgLayout.y}px`,
          }}
        />
        {/* 四边形覆盖层 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <polygon
            points={corners.map((p) => { const d = imgToDom(p); return `${d.x},${d.y}`; }).join(" ")}
            fill="rgba(0, 188, 212, 0.12)"
            stroke="#00bcd4"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        </svg>
        {/* 四个拖拽手柄 */}
        {corners.map((p, i) => {
          const d = imgToDom(p);
          const outOfBounds = isOutOfBounds(p);
          const handleColor = outOfBounds ? "#ff4444" : colors[i];
          return (
            <div key={i}>
              <div
                className="absolute flex items-center justify-center"
                style={{
                  left: d.x, top: d.y,
                  width: touchSize, height: touchSize,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10, touchAction: "none", cursor: "grab",
                }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDragIdx(i); }}
                onTouchStart={(e) => { e.preventDefault(); setDragIdx(i); }}
              >
                <svg
                  width={handleRadius * 2}
                  height={handleRadius * 2}
                  viewBox={`0 0 ${handleRadius * 2} ${handleRadius * 2}`}
                  className="pointer-events-none"
                  style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.5))" }}
                >
                  <circle cx={handleRadius} cy={handleRadius} r={handleRadius - 2} fill="none" stroke={handleColor} strokeWidth="2" />
                  <circle cx={handleRadius} cy={handleRadius} r="3" fill={handleColor} />
                  <line x1={handleRadius} y1="0" x2={handleRadius} y2={handleRadius - 5} stroke={handleColor} strokeWidth="2" />
                  <line x1={handleRadius} y1={handleRadius + 5} x2={handleRadius} y2={handleRadius * 2} stroke={handleColor} strokeWidth="2" />
                  <line x1="0" y1={handleRadius} x2={handleRadius - 5} y2={handleRadius} stroke={handleColor} strokeWidth="2" />
                  <line x1={handleRadius + 5} y1={handleRadius} x2={handleRadius * 2} y2={handleRadius} stroke={handleColor} strokeWidth="2" />
                </svg>
              </div>
              {outOfBounds && (
                <div className="absolute text-xs font-bold text-red-500 pointer-events-none" style={{ left: d.x, top: d.y - touchSize / 2 - 14, transform: "translateX(-50%)", zIndex: 11 }}>
                  {labels[i]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-end gap-3 px-5 py-4 bg-white border-t border-gray-200 shrink-0">
        <button
          className="flex-1 py-3 rounded-xl text-base font-medium text-gray-600 bg-gray-100"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          className="flex-1 py-3 rounded-xl text-base font-medium text-white bg-blue-600"
          onClick={() => onConfirm(corners)}
        >
          确认裁剪
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建通过**

```bash
cd /d/code/doc-scan && npx next build 2>&1 | tail -5
```
Expected: 构建成功，无报错

---

### Task 3: 创建 WechatScanner.tsx 主组件

**Files:**
- Create: `components/WechatScanner.tsx`

**Interfaces:**
- Consumes: `detectDocumentCorners`, `processImageWithCorners`, `ScanMode`, `CornerPoints` 来自 `@/utils/imageProcess`
- Produces: `WechatScanner` 组件（无 props，self-contained）

**状态管理：**
- `imageSrc: string | null` — 当前图片 dataUrl
- `activeMode: ScanMode` — 当前扫描模式
- `phase: "idle" | "init" | "detect" | "process"` — 处理阶段
- `result: ScanResult | null` — 处理结果
- `lastCorners: CornerPoints | null` — 检测到的角点
- `showEditor: boolean` — 是否显示编辑器
- `imageDimensions: { w: number; h: number }` — 图片尺寸

**UI 流程：**

```
┌─────────────────────────────────┐
│  初始状态（无图）                 │
│  ┌───┐  ┌──────────┐           │
│  │📷│  │ 🖼 从相册  │           │
│  │拍照│  │  选择     │           │
│  └───┘  └──────────┘           │
│  支持 JPG/PNG/WebP              │
├─────────────────────────────────┤
│  有图状态（未处理）               │
│  ┌──────────────────────┐       │
│  │   图片预览            │       │
│  └──────────────────────┘       │
│  [黑白] [彩色] [去阴影]  ← 模式  │
│  [🎯 检测文档边界]              │
├─────────────────────────────────┤
│  处理完成状态                     │
│  ┌──────────────────────┐       │
│  │   结果预览            │       │
│  └──────────────────────┘       │
│  [重新上传] [手动调整] [下载]     │
└─────────────────────────────────┘
```

- [ ] **Step 1: 创建 WechatScanner.tsx**

```tsx
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (phase === "init" || phase === "detect") setPhase("idle");
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
    } catch {}
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
```

- [ ] **Step 2: 验证构建通过**

```bash
cd /d/code/doc-scan && npx next build 2>&1 | tail -5
```
Expected: 构建成功，无报错

---

### Task 4: 创建 `/wechat/page.tsx` 入口页

**Files:**
- Create: `app/wechat/page.tsx`

**Interfaces:**
- Consumes: `WechatScanner` 组件

- [ ] **Step 1: 创建 wechat 页面**

```tsx
"use client";
import WechatScanner from "@/components/WechatScanner";

export default function WechatPage() {
  return <WechatScanner />;
}
```

- [ ] **Step 2: 完整构建验证**

```bash
cd /d/code/doc-scan && npx next build 2>&1
```
Expected: 构建成功，无报错

- [ ] **Step 3: 本地开发验证**

```bash
cd /d/code/doc-scan && npm run dev
```
在浏览器中访问 `http://localhost:3000/wechat/`，确认：
1. 页面显示拍照/相册按钮
2. 选择图片后显示预览 + 模式选择 + 检测按钮
3. 点击检测 → 角点编辑器（可拖拽四个角点）
4. 确认裁剪 → 处理 → 显示结果
5. 结果页有长按提示 + 下载按钮
6. 重新上传按钮正常工作