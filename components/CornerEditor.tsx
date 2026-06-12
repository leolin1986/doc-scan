"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Point, CornerPoints } from "@/utils/imageProcess";
import { useTranslation } from "@/i18n";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState<CornerPoints>(initialCorners);
  const [dragIdx, setDragIdx] = useState<number>(-1);
  const [imgLayout, setImgLayout] = useState({
    x: 0, y: 0,
    w: 1, h: 1,
    scale: 1,
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

  // 将 DOM 坐标转为图像坐标
  const domToImage = useCallback(
    (cx: number, cy: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const px = (cx - rect.left - imgLayout.x) / imgLayout.scale;
      const py = (cy - rect.top - imgLayout.y) / imgLayout.scale;
      return {
        x: Math.max(0, Math.min(imageWidth, px)),
        y: Math.max(0, Math.min(imageHeight, py)),
      };
    },
    [imgLayout, imageWidth, imageHeight]
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

  // 触屏拖拽
  useEffect(() => {
    if (dragIdx < 0) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      const pt = domToImage(t.clientX, t.clientY);
      setCorners((prev) => {
        const next = [...prev] as CornerPoints;
        next[dragIdx] = pt;
        return next;
      });
    };
    const onTouchEnd = () => setDragIdx(-1);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [dragIdx, domToImage]);

  // 图像坐标 → 显示坐标
  const imgToDom = (p: Point) => ({
    x: p.x * imgLayout.scale + imgLayout.x,
    y: p.y * imgLayout.scale + imgLayout.y,
  });

  // 限制把手在容器内，确保总是可见可拖拽
  const clampHandle = (dx: number, dy: number, containerW: number, containerH: number) => ({
    x: Math.max(handleRadius, Math.min(containerW - handleRadius, dx)),
    y: Math.max(handleRadius, Math.min(containerH - handleRadius, dy)),
  });

  // 判断角点是否在图像边界外
  const isOutOfBounds = (p: Point) =>
    p.x < 0 || p.x > imageWidth || p.y < 0 || p.y > imageHeight;

  // 把手样式
  const handleRadius = 12;

  // 把手颜色（TL=青, TR=品红, BR=橙, BL=绿）
  const colors = ["#00bcd4", "#e91e63", "#ff9800", "#4caf50"];

  // 点序号 → 角名称
  const labels = ["TL", "TR", "BR", "BL"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {t("editor.title")}
          </h3>
          <p className="text-xs text-gray-400">
            {t("editor.hint")}
          </p>
        </div>

        {/* 图片编辑区 */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden bg-gray-100"
          style={{ height: "min(70vh, 600px)", cursor: dragIdx >= 0 ? "grabbing" : "default" }}
        >
          {/* 原始图片 */}
          <img
            src={imageSrc}
            alt={t("editor.alt")}
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
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

          {/* 四个把手（在 DOM 中以便接收鼠标事件） */}
          {corners.map((p, i) => {
            const d = imgToDom(p);
            const el = containerRef.current;
            const cw = el?.clientWidth ?? 0;
            const ch = el?.clientHeight ?? 0;
            const clamped = cw > 0 && ch > 0 ? clampHandle(d.x, d.y, cw, ch) : d;
            const outOfBounds = isOutOfBounds(p);
            const isClamped = outOfBounds && (clamped.x !== d.x || clamped.y !== d.y);
            return (
              <div key={i}>
                {/* 把手（始终在可见区域） */}
                <div
                  className="absolute rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                  style={{
                    left: clamped.x - handleRadius,
                    top: clamped.y - handleRadius,
                    width: handleRadius * 2,
                    height: handleRadius * 2,
                    backgroundColor: colors[i],
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    boxShadow: isClamped
                      ? "0 0 0 3px #ff4444, 0 0 0 5px white, 0 2px 8px rgba(0,0,0,0.3)"
                      : "0 0 0 2px white, 0 2px 8px rgba(0,0,0,0.3)",
                    zIndex: 10,
                    touchAction: "none",
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
                  {labels[i]}
                </div>
                {/* 越界指示箭头 */}
                {isClamped && (
                  <svg
                    className="absolute pointer-events-none"
                    style={{
                      left: clamped.x - handleRadius,
                      top: clamped.y - handleRadius,
                      width: handleRadius * 2,
                      height: handleRadius * 2,
                      zIndex: 9,
                    }}
                    viewBox="0 0 24 24"
                  >
                    <text
                      x="12" y="22"
                      textAnchor="middle"
                      fontSize="16"
                      fill="#ff4444"
                      fontWeight="bold"
                    >
                      {(p.x < 0 || p.x > imageWidth) && p.y < 0 ? "↖" :
                       p.x > imageWidth && p.y < 0 ? "↗" :
                       p.x > imageWidth && p.y > imageHeight ? "↘" :
                       p.x < 0 && p.y > imageHeight ? "↙" :
                       p.y < 0 ? "↑" :
                       p.y > imageHeight ? "↓" :
                       p.x < 0 ? "←" : "→"}
                    </text>
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200">
          <button
            className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            onClick={onCancel}
          >
            {t("editor.cancel")}
          </button>
          <button
            className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            onClick={() => onConfirm(corners)}
          >
            {t("editor.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
