"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Point, CornerPoints } from "@/utils/imageProcess";
import { useTranslation } from "@/i18n";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    setIsDesktop(window.matchMedia("(pointer: fine)").matches);
  }, []);
  return isDesktop;
}

interface CornerEditorProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  initialCorners: CornerPoints;
  onConfirm: (corners: CornerPoints) => void;
  onCancel: () => void;
}

export default function CornerEditor({
  imageSrc,
  imageWidth,
  imageHeight,
  initialCorners,
  onConfirm,
  onCancel,
}: CornerEditorProps) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const containerRef = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState<CornerPoints>(initialCorners);
  const [dragIdx, setDragIdx] = useState<number>(-1);
  const [imgLayout, setImgLayout] = useState({
    x: 0, y: 0,
    w: 1, h: 1,
    scale: 1,
  });

  // 缩放和平移状态（用 ref 存最新值，避免 useEffect 依赖导致反复注册事件）
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef({ initialDist: 0, initialZoom: 1, initialPanX: 0, initialPanY: 0, centerX: 0, centerY: 0 });

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

  // 将 DOM 坐标转为图像坐标（考虑缩放和平移）
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

  // 鼠标拖拽逻辑
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

  // 触屏拖拽 + 双指缩放
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

  // 双指缩放手势（在容器上，不依赖 dragIdx/zoom/pan，用 ref 读最新值）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const getCenter = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && dragIdx < 0) {
        e.preventDefault();
        const d = getDistance(e.touches[0], e.touches[1]);
        const c = getCenter(e.touches[0], e.touches[1]);
        pinchRef.current = { initialDist: d, initialZoom: zoomRef.current, initialPanX: panRef.current.x, initialPanY: panRef.current.y, centerX: c.x, centerY: c.y };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && dragIdx < 0) {
        e.preventDefault();
        const d = getDistance(e.touches[0], e.touches[1]);
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

  // 桌面端鼠标滚轮缩放
  useEffect(() => {
    if (!isDesktop) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(1, Math.min(5, zoomRef.current * factor));
      const scale = newZoom / zoomRef.current;
      const newPanX = cx - scale * (cx - panRef.current.x);
      const newPanY = cy - scale * (cy - panRef.current.y);
      zoomRef.current = newZoom;
      panRef.current = { x: newPanX, y: newPanY };
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isDesktop]);

  // 图像坐标 → 显示坐标（考虑缩放和平移）
  const imgToDom = (p: Point) => ({
    x: p.x * imgLayout.scale * zoom + imgLayout.x + pan.x,
    y: p.y * imgLayout.scale * zoom + imgLayout.y + pan.y,
  });

  // 判断角点是否在图像边界外
  const isOutOfBounds = (p: Point) =>
    p.x < 0 || p.x > imageWidth || p.y < 0 || p.y > imageHeight;

  // 把手样式（十字准星 + 大透明触摸区）
  const handleRadius = isDesktop ? 12 : 16;
  const touchSize = isDesktop ? 28 : 44;

  // 把手颜色（TL=青, TR=品红, BR=橙, BL=绿）
  const colors = ["#00bcd4", "#e91e63", "#ff9800", "#4caf50"];

  // 点序号 → 角名称
  const labels = ["TL", "TR", "BR", "BL"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col" style={{ maxHeight: '90vh', height: '90vh' }}>
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-gray-200 shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">
            {t("editor.title")}
          </h3>
          <p className="text-sm text-gray-400">
            {isDesktop ? t("editor.hint_desktop") : t("editor.hint")}
          </p>
        </div>

        {/* 图片编辑区 — flex-1 填充 header 和 footer 之间 */}
        <div
          ref={containerRef}
          className="relative w-full bg-gray-100 flex-1 overflow-hidden"
          style={{
            cursor: dragIdx >= 0 ? "grabbing" : "default",
            touchAction: "none",
          }}
        >
          {/* 原始图片 */}
          <img
            src={imageSrc}
            alt={t("editor.alt")}
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: `${imgLayout.x}px ${imgLayout.y}px`,
            }}
          />

          {/* 四边形覆盖层（SVG） */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* 四边形填充（半透明） */}
            <polygon
              points={corners
                .map((p) => {
                  const d = imgToDom(p);
                  return `${d.x},${d.y}`;
                })
                .join(" ")}
              fill="rgba(0, 188, 212, 0.12)"
              stroke="#00bcd4"
              strokeWidth="2"
              strokeDasharray="6 3"
            />
          </svg>

          {/* 四个把手（十字准星 + 大透明触摸区，transform 居中） */}
          {corners.map((p, i) => {
            const d = imgToDom(p);
            const outOfBounds = isOutOfBounds(p);
            const handleColor = outOfBounds ? "#ff4444" : colors[i];
            return (
              <div key={i}>
                {/* 透明触摸区域（44px，transform 居中对准坐标点） */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: d.x,
                    top: d.y,
                    width: touchSize,
                    height: touchSize,
                    transform: "translate(-50%, -50%)",
                    zIndex: 10,
                    touchAction: "none",
                    cursor: "grab",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragIdx(i);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setDragIdx(i);
                  }}
                >
                  {/* 十字准星 SVG */}
                  <svg
                    width={handleRadius * 2}
                    height={handleRadius * 2}
                    viewBox={`0 0 ${handleRadius * 2} ${handleRadius * 2}`}
                    className="pointer-events-none"
                    style={{ filter: `drop-shadow(0 0 1px rgba(0,0,0,0.5))` }}
                  >
                    {/* 外圈 */}
                    <circle
                      cx={handleRadius}
                      cy={handleRadius}
                      r={handleRadius - 2}
                      fill="none"
                      stroke={handleColor}
                      strokeWidth="2"
                    />
                    {/* 中心点 */}
                    <circle
                      cx={handleRadius}
                      cy={handleRadius}
                      r="3"
                      fill={handleColor}
                    />
                    {/* 上 */}
                    <line x1={handleRadius} y1="0" x2={handleRadius} y2={handleRadius - 5} stroke={handleColor} strokeWidth="2" />
                    {/* 下 */}
                    <line x1={handleRadius} y1={handleRadius + 5} x2={handleRadius} y2={handleRadius * 2} stroke={handleColor} strokeWidth="2" />
                    {/* 左 */}
                    <line x1="0" y1={handleRadius} x2={handleRadius - 5} y2={handleRadius} stroke={handleColor} strokeWidth="2" />
                    {/* 右 */}
                    <line x1={handleRadius + 5} y1={handleRadius} x2={handleRadius * 2} y2={handleRadius} stroke={handleColor} strokeWidth="2" />
                  </svg>
                </div>
                {/* 越界指示 */}
                {outOfBounds && (
                  <div
                    className="absolute text-xs font-bold text-red-500 pointer-events-none"
                    style={{
                      left: d.x,
                      top: d.y - touchSize / 2 - 14,
                      transform: "translateX(-50%)",
                      zIndex: 11,
                    }}
                  >
                    {labels[i]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between gap-3 px-5 py-2 md:py-2 border-t border-gray-200 shrink-0">
          <button
            className="px-4 py-2.5 md:py-1.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }}
          >
            {zoom > 1 ? `🔍 ${Math.round(zoom * 100)}%` : "🔍"}
          </button>
          <div className="flex gap-3">
            <button
              className="px-5 py-2.5 md:py-1.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              onClick={onCancel}
            >
              {t("editor.cancel")}
            </button>
            <button
              className="px-5 py-2.5 md:py-1.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              onClick={() => onConfirm(corners)}
            >
              {t("editor.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
