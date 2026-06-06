/**
 * 图像处理核心模块
 * 使用 canvas + WebAssembly 模拟 OpenCV 进行图片处理
 * 包括：边缘检测、透视校正、图像增强、二值化
 */

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

// ==================== 核心处理流程 ====================

export async function processImage(
  imageSrc: string,
  mode: ScanMode = "bw"
): Promise<ScanResult> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0);

  // 第 1 步：自动边缘检测 + 透视校正
  const edgeResult = detectAndCorrectEdges(canvas);

  // 第 2 步：图像增强（去阴影/对比度/降噪）
  let resultCanvas: OffscreenCanvas;
  if (edgeResult.cropped) {
    // 检测到文档边缘：直接使用裁切后的文档（保持自然的宽高比）
    resultCanvas = edgeResult.canvas;
  } else {
    resultCanvas = await processWithoutEdgeDetection(canvas, img);
  }

  // 第 3 步：根据模式输出
  let finalCanvas: OffscreenCanvas;
  if (mode === "bw") {
    finalCanvas = applyBlackAndWhite(resultCanvas);
  } else if (mode === "color") {
    finalCanvas = applyColorEnhance(resultCanvas);
  } else {
    finalCanvas = applyShadowRemoval(resultCanvas);
  }

  // 转回 Blob URL
  return offscreenCanvasToResult(finalCanvas);
}

// ==================== 工具函数 ====================

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

async function offscreenCanvasToResult(
  canvas: OffscreenCanvas
): Promise<ScanResult> {
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        dataUrl: reader.result as string,
        width: canvas.width,
        height: canvas.height,
        format: "png",
      });
    reader.readAsDataURL(blob);
  });
}

// ==================== 边缘检测（核心算法） ====================

interface EdgeResult {
  canvas: OffscreenCanvas;
  cropped: boolean;
}

/**
 * 多尺度文档边缘检测 + 透视校正
 *
 * 策略：
 * 1. 降采样至短边 ≤800px，大幅加速 + 抑制纹理噪声
 * 2. 强高斯模糊（σ=3）压制文字边缘，保留纸张边界
 * 3. 百分位 Canny 阈值（p90/p55），不依赖文字/纸张边缘比例
 * 4. 3 组参数从强到弱逐一尝试
 * 5. 检测到角点后反算全分辨率角点，按文档实际宽高比输出
 */
function detectAndCorrectEdges(
  canvas: HTMLCanvasElement
): EdgeResult {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;

  // —— 1. 降采样到短边 ≤800px ——
  const maxShortSide = 800;
  let scale = 1;
  if (Math.min(w, h) > maxShortSide) {
    scale = maxShortSide / Math.min(w, h);
  }
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  // 缩略图 canvas
  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = sw;
  smallCanvas.height = sh;
  const smallCtx = smallCanvas.getContext("2d")!;
  smallCtx.drawImage(canvas, 0, 0, sw, sh);

  const smallData = smallCtx.getImageData(0, 0, sw, sh);
  const pixels = smallData.data;

  // 缩略图灰度
  const gray = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    gray[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }

  // —— 2. 3 组参数尝试（sigma, lowPct, highPct）——
  // 策略：高斯模糊去除纹理噪点，高百分位阈值只保留最强边缘（纸张边界）
  const attempts: Array<[number, number, number]> = [
    [1.5, 0.40, 0.75], // 充足边缘 → Hough 有足够输入
    [2.5, 0.50, 0.82], // 中等模糊，平衡噪声与边缘
    [4.0, 0.60, 0.90], // 强模糊+高阈值：仅保留最强边缘（背景纹理太复杂时）
  ];

  for (const [sigma, lowPct, highPct] of attempts) {
    const edges = cannyEdgeDetectionWithParams(gray, sw, sh, sigma, lowPct, highPct);
    const smallCorners = findDocumentCorners(edges, sw, sh);

    if (!smallCorners) continue;

    // 将角点缩放回原始分辨率
    const invScale = 1 / scale;
    let corners: CornerPoints = [
      { x: Math.round(smallCorners[0].x * invScale), y: Math.round(smallCorners[0].y * invScale) },
      { x: Math.round(smallCorners[1].x * invScale), y: Math.round(smallCorners[1].y * invScale) },
      { x: Math.round(smallCorners[2].x * invScale), y: Math.round(smallCorners[2].y * invScale) },
      { x: Math.round(smallCorners[3].x * invScale), y: Math.round(smallCorners[3].y * invScale) },
    ];

    // 计算文档物理宽高比
    const docW = Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2]));
    const docH = Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2]));

    // 将角点向内微缩，彻底切除边缘残留的背景像素
    const marginRatio = 0.06;
    const cx = (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4;
    const cy = (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4;
    corners = corners.map(p => ({
      x: p.x + (cx - p.x) * marginRatio,
      y: p.y + (cy - p.y) * marginRatio,
    })) as CornerPoints;

    const outW = Math.round(docW);
    const outH = Math.round(docH);

    // 透视校正 → 按文档实际比例输出
    const warped = applyPerspectiveWarp(canvas, corners, outW, outH);
    return { canvas: warped, cropped: true };
  }

  // 都没找到 → 返回原图
  const offscreen = new OffscreenCanvas(w, h);
  const octx = offscreen.getContext("2d")!;
  octx.drawImage(canvas, 0, 0);
  return { canvas: offscreen, cropped: false };
}

// ==================== 边缘检测（双版本：Otsu / 百分位） ====================

/** Canny 边缘检测：Otsu 自适应阈值（供外部调用和兼容性） */
function cannyEdgeDetection(
  gray: Float32Array,
  w: number,
  h: number
): Uint8Array {
  return cannyEdgeDetectionWithParams(gray, w, h, 1.4, null);
}

/**
 * Canny 边缘检测：可指定 sigma 和百分位阈值
 * @param gray      灰度图
 * @param w         宽度
 * @param h         高度
 * @param sigma     高斯模糊 sigma（越大边缘越平滑，文本噪声越少）
 * @param lowPct    低阈值百分位（0~1），null 则用 Otsu
 * @param highPct   高阈值百分位（0~1），null 则用 Otsu
 */
function cannyEdgeDetectionWithParams(
  gray: Float32Array,
  w: number,
  h: number,
  sigma: number,
  lowPct: number | null,
  highPct?: number | null
): Uint8Array {
  // 1. 高斯模糊 (5×5 kernel)
  const blurred = gaussianBlur(gray, w, h, sigma);

  // 2. Sobel 梯度
  const magnitude = new Float32Array(w * h);
  const direction = new Float32Array(w * h);
  let maxMag = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -blurred[(y - 1) * w + (x - 1)] +
        blurred[(y - 1) * w + (x + 1)] -
        2 * blurred[y * w + (x - 1)] +
        2 * blurred[y * w + (x + 1)] -
        blurred[(y + 1) * w + (x - 1)] +
        blurred[(y + 1) * w + (x + 1)];
      const gy =
        -blurred[(y - 1) * w + (x - 1)] -
        2 * blurred[(y - 1) * w + x] -
        blurred[(y - 1) * w + (x + 1)] +
        blurred[(y + 1) * w + (x - 1)] +
        2 * blurred[(y + 1) * w + x] +
        blurred[(y + 1) * w + (x + 1)];
      const mag = Math.sqrt(gx * gx + gy * gy);
      magnitude[i] = mag;
      direction[i] = Math.atan2(gy, gx);
      if (mag > maxMag) maxMag = mag;
    }
  }

  // 3. 非极大值抑制
  const nms = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const angle = direction[i];
      const mag = magnitude[i];

      const a = ((angle % Math.PI) + Math.PI) % Math.PI;
      let d1 = 0, d2 = 0;
      if (a < Math.PI / 8 || a >= 7 * Math.PI / 8) {
        d1 = magnitude[i - 1];
        d2 = magnitude[i + 1];
      } else if (a < 3 * Math.PI / 8) {
        d1 = magnitude[(y - 1) * w + x + 1];
        d2 = magnitude[(y + 1) * w + x - 1];
      } else if (a < 5 * Math.PI / 8) {
        d1 = magnitude[(y - 1) * w + x];
        d2 = magnitude[(y + 1) * w + x];
      } else {
        d1 = magnitude[(y - 1) * w + x - 1];
        d2 = magnitude[(y + 1) * w + x + 1];
      }
      nms[i] = (mag >= d1 && mag >= d2) ? mag : 0;
    }
  }

  // 4. 阈值选择：百分位 vs Otsu
  let highThresh: number;
  let lowThresh: number;

  if (lowPct != null && highPct != null) {
    // 百分位模式：收集所有 NMS > 0 的值排序
    const vals: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (nms[i] > 0) vals.push(nms[i]);
    }
    vals.sort((a, b) => a - b);
    const len = vals.length;
    const hiIdx = Math.floor(len * highPct);
    const loIdx = Math.floor(len * lowPct);
    highThresh = len > 0 ? Math.max(2, vals[Math.min(hiIdx, len - 1)]) : 8;
    lowThresh = len > 0 ? Math.max(1, vals[Math.min(loIdx, len - 1)]) : 3;
  } else {
    // Otsu 模式（原始逻辑）
    const hist = new Uint32Array(256);
    const scale = maxMag > 0 ? 255 / maxMag : 1;
    for (let i = 0; i < w * h; i++) {
      const b = Math.min(255, Math.floor(nms[i] * scale));
      if (nms[i] > 0) hist[b]++;
    }

    let total = 0;
    for (let t = 0; t < 256; t++) total += hist[t];
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];

    let sumB = 0, wB = 0, maxVar = 0, otsuThresh = 80;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const meanB = sumB / wB;
      const meanF = (sum - sumB) / wF;
      const var_ = wB * wF * (meanB - meanF) * (meanB - meanF);
      if (var_ > maxVar) { maxVar = var_; otsuThresh = t; }
    }

    highThresh = Math.max(8, otsuThresh / scale * 0.8);
    lowThresh = highThresh * 0.4;
  }

  // 5. 双阈值 + 边缘跟踪
  const edges = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);

  for (let i = 0; i < w * h; i++) {
    if (nms[i] >= highThresh) edges[i] = 255;
    else if (nms[i] >= lowThresh) edges[i] = 128;
  }

  function traceEdge(y: number, x: number) {
    if (y < 0 || y >= h || x < 0 || x >= w) return;
    const i = y * w + x;
    if (visited[i] || edges[i] !== 128) return;
    visited[i] = 1;
    let connected = false;
    for (let dy = -1; dy <= 1 && !connected; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dy === 0 && dx === 0) continue;
        const ni = (y + dy) * w + (x + dx);
        if (ni >= 0 && ni < w * h && edges[ni] === 255) {
          connected = true;
          break;
        }
      }
    }
    if (connected) {
      edges[i] = 255;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (dy !== 0 || dx !== 0) traceEdge(y + dy, x + dx);
    } else {
      edges[i] = 0;
    }
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      traceEdge(y, x);

  return edges;
}

/** 高斯模糊 (5×5 separable kernel) */
function gaussianBlur(gray: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const kernelSize = 5;
  const half = kernelSize >> 1;
  const kernel = new Float32Array(kernelSize);
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - half;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < kernelSize; i++) kernel[i] /= sum;

  // 水平模糊
  const temp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < kernelSize; k++) {
        const sx = Math.min(Math.max(x + k - half, 0), w - 1);
        v += kernel[k] * gray[y * w + sx];
      }
      temp[y * w + x] = v;
    }
  }

  // 垂直模糊
  const result = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < kernelSize; k++) {
        const sy = Math.min(Math.max(y + k - half, 0), h - 1);
        v += kernel[k] * temp[sy * w + x];
      }
      result[y * w + x] = v;
    }
  }
  return result;
}

// ==================== 文档角点检测（凸包 + 多边形逼近） ====================

export interface Point { x: number; y: number; }
export type CornerPoints = [Point, Point, Point, Point];

/** 叉积（判断三点方向） */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Graham 扫描法求凸包 */
function convexHull(points: Point[]): Point[] {
  if (points.length <= 3) return [...points];

  // 按 x 再按 y 排序
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  // 下凸包
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }

  // 上凸包
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** 点到线段的垂直距离 */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  return Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / len;
}

/** Douglas-Peucker 多边形简化 */
function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolygon(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyPolygon(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/**
 * 按质心角度排序四个角点：返回 [TL, TR, BR, BL]
 *
 * 屏幕坐标系 y 向下，atan2 从小到大排序即为 [TL, TR, BR, BL]
 */
function orderCorners(pts: [Point, Point, Point, Point]): CornerPoints {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= 4; cy /= 4;

  const withAngle = pts.map(p => ({ p, angle: Math.atan2(p.y - cy, p.x - cx) }));
  withAngle.sort((a, b) => a.angle - b.angle);

  // 屏幕坐标系（y 向下），atan2 按角度从小到大排序为 [TL, TR, BR, BL]
  // 直接返回排序后的结果，即为 applyPerspectiveWarp 所需的顺序
  return [
    withAngle[0].p,  // TL
    withAngle[1].p,  // TR
    withAngle[2].p,  // BR
    withAngle[3].p,  // BL
  ];
}

/** 给四边形打分：矩形度 × 面积比 × 边界约束 */
function scoreQuadrilateral(corners: CornerPoints, w: number, h: number): number {
  const [tl, tr, br, bl] = corners;

  // 1. 矩形度：4 个角接近 90° 的程度（0~1）
  const angleScore = (
    (1 - angleDiff(angleBetween(bl, tl, tr), Math.PI / 2)) +
    (1 - angleDiff(angleBetween(tl, tr, br), Math.PI / 2)) +
    (1 - angleDiff(angleBetween(tr, br, bl), Math.PI / 2)) +
    (1 - angleDiff(angleBetween(br, bl, tl), Math.PI / 2))
  ) / 4;

  // 2. 凸性检查：对角线交点应在四边形内部
  const convex = isConvex(corners) ? 1 : 0.3;

  // 3. 面积比：文档通常是图中最大的四边形，越大越好
  const area = polygonArea(corners);
  const areaScore = Math.min(1, area / (w * h));

  // 4. 边长比（避免太扁长）
  const sides = [
    dist(tl, tr), dist(tr, br), dist(br, bl), dist(bl, tl)
  ];
  const avgSide = (sides[0] + sides[2]) / 2;
  const avgSide2 = (sides[1] + sides[3]) / 2;
  const aspectRatio = avgSide > 0 && avgSide2 > 0
    ? Math.min(avgSide, avgSide2) / Math.max(avgSide, avgSide2)
    : 0;
  const aspectScore = Math.min(1, aspectRatio * 2);

  // 5. 越界惩罚（超出图像边界）
  const margin = Math.min(w, h) * 0.05;
  let boundsScore = 0;
  for (const p of [tl, tr, br, bl]) {
    const dx = Math.max(0, -p.x, p.x - w) - margin;
    const dy = Math.max(0, -p.y, p.y - h) - margin;
    if (dx > 0 || dy > 0) {
      const penalty = Math.sqrt(dx * dx + dy * dy) / (Math.min(w, h) * 0.3);
      boundsScore -= Math.min(0.5, penalty);
    }
  }
  const insideCount = [tl, tr, br, bl].filter(p =>
    p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h
  ).length;
  if (insideCount === 0) return -1;

  return (
    angleScore * 0.25 +
    areaScore * 0.30 +
    convex * 0.10 +
    aspectScore * 0.10 +
    (insideCount / 4) * 0.10 +
    boundsScore * 0.10
  );
}

function angleDiff(a: number, b: number): number {
  return Math.min(Math.abs(a - b), Math.PI - Math.abs(a - b)) / (Math.PI / 2);
}

function angleBetween(a: Point, center: Point, b: Point): number {
  const dx1 = a.x - center.x, dy1 = a.y - center.y;
  const dx2 = b.x - center.x, dy2 = b.y - center.y;
  const dot = dx1 * dx2 + dy1 * dy2;
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  if (len1 < 1e-10 || len2 < 1e-10) return Math.PI / 2;
  return Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2))));
}

function polygonArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function isConvex(corners: CornerPoints): boolean {
  let pos = 0, neg = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const k = (i + 2) % 4;
    const c = cross(corners[i], corners[j], corners[k]);
    if (c > 0) pos++;
    else if (c < 0) neg++;
  }
  return pos === 0 || neg === 0 || pos === 4 || neg === 4;
}

/**
 * Hough 直线变换：从边缘图中检测直线
 * 返回按投票数降序排列的直线（θ ∈ [0, π), ρ: 有符号距离）
 */
function houghLineTransform(
  edges: Uint8Array,
  w: number,
  h: number
): Array<{ rho: number; theta: number; votes: number }> {
  const maxRho = Math.ceil(Math.sqrt(w * w + h * h));
  const numRho = 2 * maxRho + 1;        // -maxRho ~ +maxRho
  const numTheta = 180;                  // 每 1° 一个步长

  // 预计算 sin/cos 表
  const cosTable = new Float64Array(numTheta);
  const sinTable = new Float64Array(numTheta);
  for (let i = 0; i < numTheta; i++) {
    cosTable[i] = Math.cos((i * Math.PI) / numTheta);
    sinTable[i] = Math.sin((i * Math.PI) / numTheta);
  }

  const acc = new Int32Array(numTheta * numRho);

  // 遍历边缘像素并投票
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      if (edges[rowOff + x] === 0) continue;
      for (let t = 0; t < numTheta; t++) {
        const rho = x * cosTable[t] + y * sinTable[t];
        const ri = Math.round(rho + maxRho);
        if (ri >= 0 && ri < numRho) {
          acc[t * numRho + ri]++;
        }
      }
    }
  }

  // 找局部峰值（NMS 3×3）
  const minVotes = Math.min(w, h) * 0.12;
  const lines: Array<{ rho: number; theta: number; votes: number }> = [];

  for (let t = 0; t < numTheta; t++) {
    for (let r = 0; r < numRho; r++) {
      const v = acc[t * numRho + r];
      if (v < minVotes) continue;

      let isMax = true;
      for (let dt = -1; dt <= 1 && isMax; dt++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (dt === 0 && dr === 0) continue;
          const nt = t + dt;
          const nr = r + dr;
          if (nt >= 0 && nt < numTheta && nr >= 0 && nr < numRho) {
            if (acc[nt * numRho + nr] >= v) {
              isMax = false;
              break;
            }
          }
        }
      }

      if (isMax) {
        lines.push({
          rho: r - maxRho,
          theta: (t * Math.PI) / numTheta,
          votes: v,
        });
      }
    }
  }

  return lines.sort((a, b) => b.votes - a.votes);
}

/** 将直线 θ 归一化到 [0, π/2]，ρ 相应取反，方便按方向聚类 */
function normalizeLine(
  line: { rho: number; theta: number }
): { rho: number; theta: number } {
  let { rho, theta } = line;
  // 归一化到 [0, π)
  theta = ((theta % Math.PI) + Math.PI) % Math.PI;
  if (theta > Math.PI / 2) {
    theta = Math.PI - theta;
    rho = -rho;
  }
  return { rho, theta };
}

/** 两条直线的交点 */
function lineIntersection(
  rho1: number, theta1: number,
  rho2: number, theta2: number
): Point | null {
  const cos1 = Math.cos(theta1), sin1 = Math.sin(theta1);
  const cos2 = Math.cos(theta2), sin2 = Math.sin(theta2);
  const det = cos1 * sin2 - sin1 * cos2;
  if (Math.abs(det) < 1e-10) return null;
  return {
    x: (rho1 * sin2 - rho2 * sin1) / det,
    y: (-rho1 * cos2 + rho2 * cos1) / det,
  };
}

/** 从 Hough 直线中选出文档的 4 条边缘线 → 求交得到 4 个角点 */
function findQuadrilateralFromLines(
  lines: Array<{ rho: number; theta: number; votes: number }>,
  w: number,
  h: number,
  clusterMult: number = 1.0
): CornerPoints | null {
  if (lines.length < 4) return null;

  // 分离为水平线（θ ≈ 90°）和垂直线（θ ≈ 0°）
  // 注意：normalizeLine 已确保 θ ∈ [0, π/2]，ρ 已相应取反
  // θ 接近 π/2 → 水平方向(主要是 y 贡献)，θ 接近 0 → 垂直方向(主要是 x 贡献)
  const horiz: Array<{ rho: number; theta: number; votes: number }> = [];
  const vert: Array<{ rho: number; theta: number; votes: number }> = [];

  for (const line of lines) {
    const n = normalizeLine(line);
    // 用经过原点的线在当前角度下的"截距"来近似分类
    // 当 θ>45° 时 sinθ > cosθ，ρ ≈ y*sinθ → ρ 主要反映 y 位置
    // 当 θ<45° 时 cosθ > sinθ，ρ ≈ x*cosθ → ρ 主要反映 x 位置
    if (n.theta > Math.PI / 4) {
      horiz.push({ rho: n.rho, theta: n.theta, votes: line.votes });
    } else {
      vert.push({ rho: n.rho, theta: n.theta, votes: line.votes });
    }
  }

  // 分别按 ρ 排序
  const sortRho = (a: typeof horiz[0], b: typeof horiz[0]) => a.rho - b.rho;
  horiz.sort(sortRho);
  vert.sort(sortRho);

  if (horiz.length < 2 || vert.length < 2) return null;

  // 聚类：将相近 ρ 的直线合并为一组
  function clusterLines(
    arr: Array<{ rho: number; theta: number; votes: number }>,
    maxDist: number
  ): Array<{ rho: number; theta: number; votes: number }> {
    if (arr.length === 0) return [];
    const groups: Array<Array<{ rho: number; theta: number; votes: number }>> = [[arr[0]]];
    for (let i = 1; i < arr.length; i++) {
      const last = groups[groups.length - 1];
      if (Math.abs(arr[i].rho - last[last.length - 1].rho) < maxDist) {
        last.push(arr[i]);
      } else {
        groups.push([arr[i]]);
      }
    }
    // 每组取最高票
    return groups.map((g) =>
      g.reduce((a, b) => (a.votes > b.votes ? a : b))
    );
  }

  const clusterDist = Math.min(w, h) * 0.02 * clusterMult;
  const hClusters = clusterLines(horiz, clusterDist);
  const vClusters = clusterLines(vert, clusterDist);

  if (hClusters.length < 2 || vClusters.length < 2) return null;

  let bestCorners: CornerPoints | null = null;
  let bestScore = -Infinity;

  // 枚举所有可能的 (top, bottom) 水平线对 × (left, right) 垂直线对
  const minDist = Math.min(w, h) * 0.1;

  // 预生成水平线对（top.before bottom）
  const hPairs: Array<{ top: typeof hClusters[0]; bottom: typeof hClusters[0] }> = [];
  for (let i = 0; i < hClusters.length; i++) {
    for (let j = i + 1; j < hClusters.length; j++) {
      if (hClusters[j].rho - hClusters[i].rho >= minDist) {
        hPairs.push({ top: hClusters[i], bottom: hClusters[j] });
      }
    }
  }

  // 预生成垂直线对（left.before right）
  const vPairs: Array<{ left: typeof vClusters[0]; right: typeof vClusters[0] }> = [];
  for (let i = 0; i < vClusters.length; i++) {
    for (let j = i + 1; j < vClusters.length; j++) {
      if (vClusters[j].rho - vClusters[i].rho >= minDist) {
        vPairs.push({ left: vClusters[i], right: vClusters[j] });
      }
    }
  }

  if (hPairs.length === 0 || vPairs.length === 0) return null;

  // 按线强度（总票数）排序，边越清晰越优先
  hPairs.sort((a, b) => (b.top.votes + b.bottom.votes) - (a.top.votes + a.bottom.votes));
  vPairs.sort((a, b) => (b.left.votes + b.right.votes) - (a.left.votes + a.right.votes));

  // 最多检查前 N 对，防性能爆炸
  const maxHPairs = Math.min(hPairs.length, 20);
  const maxVPairs = Math.min(vPairs.length, 24);

  for (let hi = 0; hi < maxHPairs; hi++) {
    const { top, bottom } = hPairs[hi];
    for (let vi = 0; vi < maxVPairs; vi++) {
      const { left, right } = vPairs[vi];

      const tl = lineIntersection(top.rho, top.theta, left.rho, left.theta);
      const tr = lineIntersection(top.rho, top.theta, right.rho, right.theta);
      const br = lineIntersection(bottom.rho, bottom.theta, right.rho, right.theta);
      const bl = lineIntersection(bottom.rho, bottom.theta, left.rho, left.theta);
      if (!tl || !tr || !br || !bl) continue;

      // 检查角点是否在图像范围内（可稍超出）
      const margin = Math.max(w, h) * 0.5;
      if ([tl, tr, br, bl].some(p =>
        p.x < -margin || p.x > w + margin ||
        p.y < -margin || p.y > h + margin
      )) continue;

      const corners = orderCorners([tl, tr, br, bl]);
      const score = scoreQuadrilateral(corners, w, h);
      if (score > bestScore) {
        bestScore = score;
        bestCorners = corners;
      }
    }
  }

  if (!bestCorners || bestScore < 0.15) return null;
  return bestCorners;
}

/** 从边缘图中提取 A4 文档的四个角点（Hough 直线检测 + 四边形拟合） */
function findDocumentCorners(
  edges: Uint8Array,
  w: number,
  h: number
): CornerPoints | null {
  const lines = houghLineTransform(edges, w, h);
  const top60 = lines.slice(0, 60);
  if (top60.length < 4) return null;

  // 尝试多组聚类参数
  let best: CornerPoints | null = null;
  let bestScore = -Infinity;

  for (const mult of [0.8, 1.0, 1.4]) {
    const corners = findQuadrilateralFromLines(top60, w, h, mult);
    if (corners) {
      const score = scoreQuadrilateral(corners, w, h);
      if (score > bestScore) {
        bestScore = score;
        best = corners;
      }
    }
  }

  return best;
}

/** 从多个顶点中选出最可能是文档 4 角的点 */
function pickBest4Corners(points: Point[]): [Point, Point, Point, Point] {
  // 策略：找到每一边的最极端点
  // 计算中心
  let cx = 0, cy = 0;
  for (const p of points) { cx += p.x; cy += p.y; }
  cx /= points.length;
  cy /= points.length;

  // 分成四象限取离中心最远的点
  const quads: Point[][] = [[], [], [], []];
  for (const p of points) {
    if (p.x <= cx && p.y <= cy) quads[0].push(p); // TL
    else if (p.x > cx && p.y <= cy) quads[1].push(p); // TR
    else if (p.x > cx && p.y > cy) quads[2].push(p); // BR
    else quads[3].push(p); // BL
  }

  const result: [Point, Point, Point, Point] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
  for (let i = 0; i < 4; i++) {
    if (quads[i].length === 0) {
      // 某个象限没有点，用中心点
      result[i] = { x: cx, y: cy };
    } else {
      // 取离中心最远的点
      let best = quads[i][0];
      let maxDist = 0;
      for (const p of quads[i]) {
        const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
        if (d > maxDist) { maxDist = d; best = p; }
      }
      result[i] = best;
    }
  }

  return result;
}

// ==================== 透视变换（Homography） ====================

/** 计算单应性矩阵（DLT 算法） */
function computeHomography(src: CornerPoints, dst: CornerPoints): number[] {
  // 构建 8×8 矩阵 A 和 8×1 向量 b
  const A: number[] = new Array(64).fill(0);
  const b: number[] = new Array(8).fill(0);

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y;
    const dx = dst[i].x, dy = dst[i].y;

    // 第 2i 行: [-sx, -sy, -1,  0,  0,  0, dx*sx, dx*sy]
    A[i * 16 + 0] = -sx;
    A[i * 16 + 1] = -sy;
    A[i * 16 + 2] = -1;
    A[i * 16 + 6] = dx * sx;
    A[i * 16 + 7] = dx * sy;
    b[i * 2] = -dx;

    // 第 2i+1 行: [ 0,  0,  0, -sx, -sy, -1, dy*sx, dy*sy]
    A[i * 16 + 8 + 3] = -sx;
    A[i * 16 + 8 + 4] = -sy;
    A[i * 16 + 8 + 5] = -1;
    A[i * 16 + 8 + 6] = dy * sx;
    A[i * 16 + 8 + 7] = dy * sy;
    b[i * 2 + 1] = -dy;
  }

  // 高斯消元法求解 A * h = b
  const aug: number[] = new Array(72).fill(0);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) aug[i * 9 + j] = A[i * 8 + j];
    aug[i * 9 + 8] = b[i];
  }

  for (let col = 0; col < 8; col++) {
    let maxVal = Math.abs(aug[col * 9 + col]);
    let maxRow = col;
    for (let row = col + 1; row < 8; row++) {
      const v = Math.abs(aug[row * 9 + col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxRow !== col) {
      for (let j = col; j <= 8; j++)
        [aug[col * 9 + j], aug[maxRow * 9 + j]] = [aug[maxRow * 9 + j], aug[col * 9 + j]];
    }
    for (let row = col + 1; row < 8; row++) {
      const factor = aug[row * 9 + col] / aug[col * 9 + col];
      for (let j = col; j <= 8; j++) aug[row * 9 + j] -= factor * aug[col * 9 + j];
    }
  }

  const h = new Array(9).fill(0);
  h[8] = 1;
  for (let i = 7; i >= 0; i--) {
    let sum = aug[i * 9 + 8];
    for (let j = i + 1; j < 8; j++) sum -= aug[i * 9 + j] * h[j];
    h[i] = sum / aug[i * 9 + i];
  }

  return h; // 3×3 行主序矩阵
}

/** 求 3×3 矩阵的逆 */
function invertHomography(H: number[]): number[] {
  const [a, b, c] = [H[0], H[1], H[2]];
  const [d, e, f] = [H[3], H[4], H[5]];
  const [g, h, i] = [H[6], H[7], H[8]];

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-10) return [1, 0, 0, 0, 1, 0, 0, 0, 1];

  const invDet = 1 / det;
  return [
    (e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet,
    (f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet,
    (d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet,
  ];
}

/** 四角透视变换 + 双线性插值，输出指定尺寸 */
export function applyPerspectiveWarp(
  canvas: HTMLCanvasElement,
  corners: CornerPoints,
  outW: number,
  outH: number
): OffscreenCanvas {
  const sw = canvas.width;
  const sh = canvas.height;
  const srcData = canvas.getContext("2d")!.getImageData(0, 0, sw, sh).data;

  const dstCorners: CornerPoints = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];

  const H = computeHomography(corners, dstCorners);
  const invH = invertHomography(H);

  const offscreen = new OffscreenCanvas(outW, outH);
  const octx = offscreen.getContext("2d")!;
  const dstImage = octx.createImageData(outW, outH);
  const dstData = dstImage.data;

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      // 从目标像素映射回源坐标（逆透视变换）
      const denom = invH[6] * dx + invH[7] * dy + invH[8];
      const sx = (invH[0] * dx + invH[1] * dy + invH[2]) / denom;
      const sy = (invH[3] * dx + invH[4] * dy + invH[5]) / denom;

      const px = Math.floor(sx);
      const py = Math.floor(sy);

      const dstIdx = (dy * outW + dx) * 4;

      if (px >= 1 && px < sw - 2 && py >= 1 && py < sh - 2) {
        // 双线性插值
        const fx = sx - px;
        const fy = sy - py;
        const idx00 = (py * sw + px) * 4;
        const idx10 = (py * sw + px + 1) * 4;
        const idx01 = ((py + 1) * sw + px) * 4;
        const idx11 = ((py + 1) * sw + px + 1) * 4;

        for (let c = 0; c < 4; c++) {
          const v =
            (1 - fx) * (1 - fy) * srcData[idx00 + c] +
            fx * (1 - fy) * srcData[idx10 + c] +
            (1 - fx) * fy * srcData[idx01 + c] +
            fx * fy * srcData[idx11 + c];
          dstData[dstIdx + c] = Math.round(Math.max(0, Math.min(255, v)));
        }
      } else {
        // 超出源图范围 → 白色填充
        dstData[dstIdx] = 255;
        dstData[dstIdx + 1] = 255;
        dstData[dstIdx + 2] = 255;
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  octx.putImageData(dstImage, 0, 0);
  return offscreen;
}

// ==================== 手动角点校正 ====================

/** 仅检测文档角点（不处理图像），供手动编辑器使用 */
export async function detectDocumentCorners(
  imageSrc: string
): Promise<{ corners: CornerPoints | null; width: number; height: number }> {
  const img = await loadImage(imageSrc);
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
  }

  const edges = cannyEdgeDetection(gray, w, h);
  const corners = findDocumentCorners(edges, w, h);
  return { corners, width: w, height: h };
}

/** 使用手动指定的角点进行透视校正 + 图像增强 */
export async function processImageWithCorners(
  imageSrc: string,
  corners: CornerPoints,
  mode: ScanMode = "bw"
): Promise<ScanResult> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // 用指定的角点做透视校正（按文档实际宽高比输出）
  const docW = Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2]));
  const docH = Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2]));
  const warped = applyPerspectiveWarp(canvas, corners, Math.round(docW), Math.round(docH));

  // 图像增强
  let finalCanvas: OffscreenCanvas;
  if (mode === "bw") {
    finalCanvas = applyBlackAndWhite(warped);
  } else if (mode === "color") {
    finalCanvas = applyColorEnhance(warped);
  } else {
    finalCanvas = applyShadowRemoval(warped);
  }

  return offscreenCanvasToResult(finalCanvas);
}

// ==================== 无边缘时的降级处理 ====================

async function processWithoutEdgeDetection(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement
): Promise<OffscreenCanvas> {
  // 没有检测到文档边缘，直接对全图做增强
  const offscreen = new OffscreenCanvas(
    canvas.width,
    canvas.height
  );
  const ctx = offscreen.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0);

  // 至少做去阴影处理，改善画质
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const len = w * h;

  // 自动色阶（直方图拉伸）
  const hist = new Uint32Array(256);
  for (let i = 0; i < len; i++) {
    const gray = Math.floor(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    hist[gray]++;
  }

  const total = len;
  const clipAmount = Math.floor(total * 0.01);
  let lo = 0, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > clipAmount) break; }
  let hi = 255; acc = 0;
  for (; hi > 0; hi--) { acc += hist[hi]; if (acc > clipAmount) break; }
  const range = hi - lo;
  if (range > 10) {
    const scale = 255 / range;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < 3; c++) {
        let v = (data[i * 4 + c] - lo) * scale;
        data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return offscreen;
}

// ==================== 三种扫描模式 ====================

/** 模式1：黑白扫描（Sauvola 局部自适应二值化 + 去噪） */
function applyBlackAndWhite(
  canvas: OffscreenCanvas
): OffscreenCanvas {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // 1. 灰度化 + 中值滤波预处理去噪
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] =
      0.299 * data[i * 4] +
      0.587 * data[i * 4 + 1] +
      0.114 * data[i * 4 + 2];
  }

  // 快速中值滤波 3×3
  const denoised = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const vals = [
        gray[i - w - 1], gray[i - w], gray[i - w + 1],
        gray[i - 1],     gray[i],     gray[i + 1],
        gray[i + w - 1], gray[i + w], gray[i + w + 1],
      ];
      vals.sort((a, b) => a - b);
      denoised[i] = vals[4];
    }
  }
  // 边缘像素直接复制
  for (let y = 0; y < h; y++) {
    denoised[y * w] = gray[y * w];
    denoised[y * w + w - 1] = gray[y * w + w - 1];
  }
  for (let x = 0; x < w; x++) {
    denoised[x] = gray[x];
    denoised[(h - 1) * w + x] = gray[(h - 1) * w + x];
  }

  // 2. 对比度拉伸（去除极端值，增强文字对比度）
  let minV = 255, maxV = 0;
  for (let i = 0; i < w * h; i++) {
    if (denoised[i] < minV) minV = denoised[i];
    if (denoised[i] > maxV) maxV = denoised[i];
  }
  const range = maxV - minV;
  if (range > 20) {
    const scale = 255 / range;
    for (let i = 0; i < w * h; i++) {
      denoised[i] = (denoised[i] - minV) * scale;
    }
  }

  // 3. Sauvola 局部自适应二值化（使用积分图加速）
  // 窗口大小：图像短边 1/8，至少 16，最多 64
  const winSize = Math.max(16, Math.min(64, Math.floor(Math.min(w, h) / 8)));
  // 窗口半径
  const r = Math.floor(winSize / 2);

  // 积分图：sum[i] = sum of gray[0..i)
  const sumInt = new Float64Array((w + 1) * (h + 1));
  const sumSqInt = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    const rowIntOff = (y + 1) * (w + 1);
    const prevRowIntOff = y * (w + 1);
    let rowSum = 0, rowSqSum = 0;
    for (let x = 0; x < w; x++) {
      const v = denoised[rowOff + x];
      rowSum += v;
      rowSqSum += v * v;
      sumInt[rowIntOff + x + 1] = sumInt[prevRowIntOff + x + 1] + rowSum;
      sumSqInt[rowIntOff + x + 1] = sumSqInt[prevRowIntOff + x + 1] + rowSqSum;
    }
  }

  // Sauvola 参数
  const k = 0.25;
  const R = 128;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;

      // 窗口边界（确保不越界）
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(w - 1, x + r);
      const y1 = Math.max(0, y - r);
      const y2 = Math.min(h - 1, y + r);

      // 积分图查窗口和 O(1)
      const winPixels = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        sumInt[(y2 + 1) * (w + 1) + x2 + 1] -
        sumInt[y1 * (w + 1) + x2 + 1] -
        sumInt[(y2 + 1) * (w + 1) + x1] +
        sumInt[y1 * (w + 1) + x1];
      const sumSq =
        sumSqInt[(y2 + 1) * (w + 1) + x2 + 1] -
        sumSqInt[y1 * (w + 1) + x2 + 1] -
        sumSqInt[(y2 + 1) * (w + 1) + x1] +
        sumSqInt[y1 * (w + 1) + x1];

      const mean = sum / winPixels;
      const variance = sumSq / winPixels - mean * mean;
      const std = variance > 0 ? Math.sqrt(variance) : 0;

      // Sauvola 阈值
      const threshold = mean * (1 + k * (std / R - 1));

      const pixel = denoised[i];
      const v = pixel > threshold ? 255 : 0;

      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
    }
  }

  // 4. 形态学去噪：孤立黑点变白（3×3 多数投票）
  // 先复制一份
  const binaryCopy = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    binaryCopy[i] = data[i * 4];
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (binaryCopy[i] === 0) {
        // 统计周围白点数量
        let whiteCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            if (binaryCopy[(y + dy) * w + (x + dx)] > 0) whiteCount++;
          }
        }
        // 如果周围 8 个中有 7+ 个白色 → 这个点是噪声，变白
        if (whiteCount >= 7) {
          data[i * 4] = 255;
          data[i * 4 + 1] = 255;
          data[i * 4 + 2] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * 模式2：彩色文档扫描（背景漂白 + 文字加深 + 颜色保留）
 *
 * 基于对扫描全能王的分析直方图得出的算法：
 * - 背景像素 → 推到 255（纯白），文件分析显示 91% 像素被推到纯白
 * - 文字像素 → 保留原色并加深对比度
 * - 使用局部自适应阈值区分前景/背景
 */
function applyColorEnhance(
  canvas: OffscreenCanvas
): OffscreenCanvas {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const len = w * h;

  // ===== 1. 灰度化 + 积分图（用于快速局部均值计算） =====
  const gray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    gray[i] =
      0.299 * data[i * 4] +
      0.587 * data[i * 4 + 1] +
      0.114 * data[i * 4 + 2];
  }

  // 积分图 O(1) 局部均值
  const sumInt = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    const rowIntOff = (y + 1) * (w + 1);
    const prevRowIntOff = y * (w + 1);
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[rowOff + x];
      sumInt[rowIntOff + x + 1] = sumInt[prevRowIntOff + x + 1] + rowSum;
    }
  }

  // 窗口大小：图像短边的 1/10，至少 24
  const winSize = Math.max(24, Math.floor(Math.min(w, h) / 10));
  // 确保奇数
  const r = Math.floor(winSize / 2);

  // ===== 2. 文档扫描核心处理 =====
  // 使用局部亮度对比度检测文字/背景
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;

      // 窗口边界
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(w - 1, x + r);
      const y1 = Math.max(0, y - r);
      const y2 = Math.min(h - 1, y + r);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);

      // 积分图查局部均值
      const sum =
        sumInt[(y2 + 1) * (w + 1) + x2 + 1] -
        sumInt[y1 * (w + 1) + x2 + 1] -
        sumInt[(y2 + 1) * (w + 1) + x1] +
        sumInt[y1 * (w + 1) + x1];

      const localMean = sum / area;
      const pixelGray = gray[i];

      // diff > 0：像素比局部平均更暗 → 可能是文字/前景
      // diff < 0：像素比局部平均更亮 → 可能是背景
      const diff = localMean - pixelGray;

      // 文字置信度：sigmoid 过渡
      // threshold=8: diff超过8才算高置信度文字
      // smoothness=4: 过渡宽度
      const textThreshold = 8;
      const smoothness = 4;
      // sigmoid: 1 / (1 + exp(-(diff - threshold) / smoothness))
      // 优化：用 clamp 线性近似避免 exp 开销
      let textConf: number;
      const raw = (diff - textThreshold) / smoothness;
      if (raw > 3) {
        textConf = 1.0;
      } else if (raw < -3) {
        textConf = 0.0;
      } else {
        // sigmoid 近似
        textConf = 1 / (1 + Math.exp(-raw));
      }

      // 根据文字置信度混合输出
      if (textConf > 0.9) {
        // 高置信度文字 → 保留颜色，加深对比度
        // 分析显示文字像素分布在 0-239，平均约 150-180
        // 我们加深文字使其更清晰
        const darkenFactor = 0.7; // 加深到 70%
        for (let c = 0; c < 3; c++) {
          let v = data[idx + c] * darkenFactor;
          // 对比度拉伸：将 [0, 180] 映射到 [0, 255]
          v = v * (255 / 180);
          data[idx + c] = Math.max(0, Math.min(255, Math.round(v)));
        }
      } else if (textConf > 0.1) {
        // 过渡区域：部分文字/部分背景
        if (textConf > 0.5) {
          // 偏文字：加深为主
          const darkenMix = (textConf - 0.5) * 2; // 0..1
          for (let c = 0; c < 3; c++) {
            const orig = data[idx + c];
            const darkened = Math.round(orig * 0.7 * (255 / 180));
            const v = Math.round(darkened * darkenMix + orig * (1 - darkenMix));
            data[idx + c] = Math.max(0, Math.min(255, v));
          }
        } else {
          // 偏背景：漂白为主
          const whitenMix = 1 - textConf * 2; // 0.8..0
          for (let c = 0; c < 3; c++) {
            const orig = data[idx + c];
            const v = Math.round(255 * (1 - whitenMix) + orig * whitenMix);
            data[idx + c] = Math.max(0, Math.min(255, v));
          }
        }
      } else {
        // 背景 → 推到纯白 255
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }
    }
  }

  // ===== 3. 精细锐化（仅对文字边缘） =====
  // 用 USM 提升文字清晰度，但避免增强噪点
  for (let c = 0; c < 3; c++) {
    const src = new Uint8Array(len);
    for (let i = 0; i < len; i++) src[i] = data[i * 4 + c];

    const blurred = new Uint8Array(len);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const val =
          src[i - w - 1] + src[i - w] + src[i - w + 1] +
          src[i - 1]     + src[i]     + src[i + 1] +
          src[i + w - 1] + src[i + w] + src[i + w + 1];
        blurred[i] = Math.round(val / 9);
      }
    }
    for (let x = 0; x < w; x++) { blurred[x] = src[x]; blurred[(h - 1) * w + x] = src[(h - 1) * w + x]; }
    for (let y = 0; y < h; y++) { blurred[y * w] = src[y * w]; blurred[y * w + w - 1] = src[y * w + w - 1]; }

    // 仅在边缘增强（diff 较大处），阈值更高避免噪点
    for (let i = 0; i < len; i++) {
      const diff = src[i] - blurred[i];
      if (Math.abs(diff) > 8) {
        let v = Math.round(src[i] + 0.5 * diff);
        data[i * 4 + c] = Math.max(0, Math.min(255, v));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** 
 * 模式3：文档扫描增强（基于光照归一化的背景漂白 + 文字加深）
 *
 * 比彩色模式更强的文档扫描效果：
 * - 更激进的背景漂白
 * - 更强的文字加深对比度
 * - 保留文档原色
 */
function applyShadowRemoval(
  canvas: OffscreenCanvas
): OffscreenCanvas {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;
  const len = w * h;

  // ===== 1. 灰度化 + 积分图 =====
  const gray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    gray[i] =
      0.299 * data[i * 4] +
      0.587 * data[i * 4 + 1] +
      0.114 * data[i * 4 + 2];
  }

  const sumInt = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    const rowIntOff = (y + 1) * (w + 1);
    const prevRowIntOff = y * (w + 1);
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[rowOff + x];
      sumInt[rowIntOff + x + 1] = sumInt[prevRowIntOff + x + 1] + rowSum;
    }
  }

  // 窗口大小：比彩色模式稍大（短边 1/8）
  const winSize = Math.max(32, Math.floor(Math.min(w, h) / 8));
  const r = Math.floor(winSize / 2);

  // ===== 2. 背景光照估计 =====
  // 用盒式模糊作为背景光照估计
  const background = new Float32Array(len);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(w - 1, x + r);
      const y1 = Math.max(0, y - r);
      const y2 = Math.min(h - 1, y + r);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        sumInt[(y2 + 1) * (w + 1) + x2 + 1] -
        sumInt[y1 * (w + 1) + x2 + 1] -
        sumInt[(y2 + 1) * (w + 1) + x1] +
        sumInt[y1 * (w + 1) + x1];
      background[y * w + x] = sum / area;
    }
  }

  // ===== 3. 光照归一化 + 背景漂白 + 文字加深 =====
  // 基于 Retinex 理论：反射率 = 原始值 / 光照估计
  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    const pixelGray = gray[i];
    const bgEstimate = background[i];

    // 光照归一化：将像素除以其背景光照估计
    // 暗像素（文字）：bgEstimate > pixelGray → 归一化值 < 1
    // 亮像素（背景）：bgEstimate ≈ pixelGray → 归一化值 ≈ 1
    const minBg = 30; // 避免除零
    const effectiveBg = Math.max(bgEstimate, minBg);
    const normalized = pixelGray / effectiveBg;

    // 文字置信度：归一化值越低 → 越可能是文字
    // normalized ≈ 1.0 → 背景 | normalized << 1.0 → 文字
    const textConf = Math.max(0, Math.min(1, (1.0 - normalized) * 3.0));

    for (let c = 0; c < 3; c++) {
      const orig = data[idx + c];

      if (textConf > 0.5) {
        // 文字区域：基于光照归一化重建，加深
        // 反射率 = orig / effectiveBg，然后对比度拉伸
        let reflectance = orig / effectiveBg;
        // 强对比度拉伸：将小反射率映射到暗值
        let v = reflectance * 255 * (1 - textConf * 0.4);
        v = Math.max(0, Math.min(255, Math.round(v)));
        data[idx + c] = v;
      } else if (textConf > 0.15) {
        // 过渡区域
        const mix = (textConf - 0.15) / 0.35; // 0..1
        const textVal = Math.round(Math.max(0, Math.min(255, (orig / effectiveBg) * 255 * 0.7)));
        const bgVal = 255;
        const v = Math.round(textVal * mix + bgVal * (1 - mix));
        data[idx + c] = Math.max(0, Math.min(255, v));
      } else {
        // 背景 → 推白
        // 但对彩色背景保留轻微色调
        const whiteAmount = 0.95 + textConf * 0.5; // 0.95..1.0
        const v = Math.round(255 * whiteAmount + orig * (1 - whiteAmount));
        data[idx + c] = Math.max(0, Math.min(255, v));
      }
    }
  }

  // ===== 4. 最终锐化（仅文字边缘） =====
  for (let c = 0; c < 3; c++) {
    const src = new Uint8Array(len);
    for (let i = 0; i < len; i++) src[i] = data[i * 4 + c];

    const blurred = new Uint8Array(len);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const val =
          src[i - w - 1] + src[i - w] + src[i - w + 1] +
          src[i - 1]     + src[i]     + src[i + 1] +
          src[i + w - 1] + src[i + w] + src[i + w + 1];
        blurred[i] = Math.round(val / 9);
      }
    }
    for (let x = 0; x < w; x++) { blurred[x] = src[x]; blurred[(h - 1) * w + x] = src[(h - 1) * w + x]; }
    for (let y = 0; y < h; y++) { blurred[y * w] = src[y * w]; blurred[y * w + w - 1] = src[y * w + w - 1]; }

    for (let i = 0; i < len; i++) {
      const diff = src[i] - blurred[i];
      if (Math.abs(diff) > 6) {
        let v = Math.round(src[i] + 0.6 * diff);
        data[i * 4 + c] = Math.max(0, Math.min(255, v));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
