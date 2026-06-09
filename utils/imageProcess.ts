/**
 * 图像处理核心模块
 * 所有 OpenCV 操作在 Web Worker 中执行，不阻塞 UI
 */

import {
  detectCornersInWorker,
  processImageInWorker,
} from "@/workers/opencvWorkerClient";

// ==================== 类型定义 ====================

export type ScanMode = "bw" | "color" | "enhanced";

export interface ScanResult {
  dataUrl: string;
  width: number;
  height: number;
  format: string;
}

export interface ModeOption {
  id: ScanMode;
  label: string;
  desc: string;
  icon: string;
}

export interface Point {
  x: number;
  y: number;
}
export type CornerPoints = [Point, Point, Point, Point];

// ==================== 核心处理流程 ====================

export async function processImage(
  imageSrc: string,
  mode: ScanMode = "bw"
): Promise<ScanResult> {
  // 先检测角点，再用检测到的角点处理
  const det = await detectCornersInWorker(imageSrc);

  if (det.corners) {
    return processImageInWorker(imageSrc, det.corners, mode);
  }

  // 没检测到角点，用全图作为输入
  const fullCorners: CornerPoints = [
    { x: 0, y: 0 },
    { x: det.width - 1, y: 0 },
    { x: det.width - 1, y: det.height - 1 },
    { x: 0, y: det.height - 1 },
  ];
  return processImageInWorker(imageSrc, fullCorners, mode);
}

// ==================== 手动角点校正 ====================

/** 仅检测文档角点（不处理图像），供手动编辑器使用 */
export async function detectDocumentCorners(
  imageSrc: string
): Promise<{ corners: CornerPoints | null; width: number; height: number }> {
  return detectCornersInWorker(imageSrc);
}

/** 使用手动指定的角点进行透视校正 + 图像增强 */
export async function processImageWithCorners(
  imageSrc: string,
  corners: CornerPoints,
  mode: ScanMode = "bw"
): Promise<ScanResult> {
  return processImageInWorker(imageSrc, corners, mode);
}
