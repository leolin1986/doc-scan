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
  const layoutRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const pinchRef = useRef({
    initialDist: 0, initialZoom: 1,
    initialPanX: 0, initialPanY: 0,
    centerX: 0, centerY: 0,
    ox: 0, oy: 0,
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
    layoutRef.current = { x, y, w: dw, h: dh };
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
        const l = layoutRef.current;
        pinchRef.current = {
          initialDist: d, initialZoom: zoomRef.current,
          initialPanX: panRef.current.x, initialPanY: panRef.current.y,
          centerX: c.x, centerY: c.y,
          ox: l.x + l.w / 2, oy: l.y + l.h / 2,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && dragIdx < 0) {
        e.preventDefault();
        const d = getDist(e.touches[0], e.touches[1]);
        if (d === 0) return;
        const c = getCenter(e.touches[0], e.touches[1]);
        const { initialDist, initialZoom, initialPanX, initialPanY, centerX, centerY, ox, oy } = pinchRef.current;
        const newZoom = Math.max(1, Math.min(5, initialZoom * (d / initialDist)));
        const ratio = newZoom / initialZoom;
        const newPanX = c.x - ratio * (centerX - initialPanX) + (ratio - 1) * ox;
        const newPanY = c.y - ratio * (centerY - initialPanY) + (ratio - 1) * oy;
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
          {zoom > 1 ? `${Math.round(zoom * 100)}%` : "重置"}
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
            transformOrigin: `${imgLayout.x + imgLayout.w/2}px ${imgLayout.y + imgLayout.h/2}px`,
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