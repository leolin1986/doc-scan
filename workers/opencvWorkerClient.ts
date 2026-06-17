/**
 * OpenCV Worker 客户端封装
 * 主线程通过此模块与 worker 通信，Promise 包装 postMessage
 */

import { ScanResult, CornerPoints, ScanMode } from "@/utils/imageProcess";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();

let progressCallback: ((stage: string) => void) | null = null;

export function setProgressCallback(cb: ((stage: string) => void) | null) {
  progressCallback = cb;
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(
    new URL("./opencvWorker.ts", import.meta.url),
    { type: "module" }
  );

  worker.onmessage = (e) => {
    const { id, success, result, error, type } = e.data;

    // 进度广播消息（无 id）
    if (type === "progress" && progressCallback) {
      progressCallback(e.data.stage);
      return;
    }

    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);

    if (success) {
      p.resolve(result);
    } else {
      p.reject(new Error(error));
    }
  };

  worker.onerror = (e) => {
    // 拒绝所有 pending 请求
    pending.forEach((p, id) => {
      p.reject(new Error(e.message || "Worker error"));
      pending.delete(id);
    });
  };

  return worker;
}

function sendRequest(type: string, payload: any): Promise<any> {
  const w = getWorker();
  const id = nextId++;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, type, ...payload });
  });
}

/**
 * 加载图片并转为 ImageData
 */
async function imageToImageData(imageSrc: string): Promise<ImageData> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 检测文档角点
 */
export async function detectCornersInWorker(
  imageSrc: string
): Promise<{ corners: CornerPoints | null; width: number; height: number }> {
  const imageData = await imageToImageData(imageSrc);
  return sendRequest("detectCorners", { imageData });
}

/**
 * 透视校正 + 扫描处理
 */
export async function processImageInWorker(
  imageSrc: string,
  corners: CornerPoints,
  mode: ScanMode
): Promise<ScanResult> {
  const imageData = await imageToImageData(imageSrc);
  const result = await sendRequest("processImage", {
    imageData,
    corners,
    mode,
  });

  // result.pixels 是 ArrayBuffer，在主线程创建 PNG（避免 Worker 中 OffscreenCanvas 兼容问题）
  const resultImageData = new ImageData(
    new Uint8ClampedArray(result.pixels),
    result.width,
    result.height
  );
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;
  canvas.getContext("2d")!.putImageData(resultImageData, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");

  return {
    dataUrl,
    width: result.width,
    height: result.height,
    format: "png",
  };
}
