/**
 * OpenCV.js Web Worker
 * 所有 OpenCV 操作在 worker 线程执行，不阻塞 UI
 */

/* eslint-disable no-restricted-globals */

// Worker 全局类型声明
declare function importScripts(...urls: string[]): void;
declare function postMessage(message: any, transfer?: Transferable[]): void;

let cv: any = null;
let cvReady = false;

const OPENCV_URL = "/opencv/opencv.js";

// ==================== OpenCV 加载 ====================

function loadOpenCV(): Promise<void> {
  if (cvReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // 已经有 cv 对象（可能之前的调用正在初始化）
    if ((globalThis as any).cv?.Mat) {
      cv = (globalThis as any).cv;
      cvReady = true;
      resolve();
      return;
    }

    // 注册就绪回调（OpenCV.js 支持）
    (globalThis as any).Module = {
      onRuntimeInitialized: () => {
        cv = (globalThis as any).cv;
        cvReady = true;
        resolve();
      },
    };

    // 加载脚本
    importScripts(OPENCV_URL);

    // 有些版本的 OpenCV.js 在 importScripts 后就直接就绪了
    // 通过轮询 cv.Mat 兜底
    const cvObj = (globalThis as any).cv;
    if (cvObj?.Mat) {
      cv = cvObj;
      cvReady = true;
      resolve();
      return;
    }

    // 轮询等待
    const pollInterval = 50;
    const timeout = 60000;
    const start = Date.now();

    function check() {
      const c = (globalThis as any).cv;
      if (c?.Mat) {
        cv = c;
        cvReady = true;
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error("OpenCV.js 加载超时"));
      } else {
        setTimeout(check, pollInterval);
      }
    }
    setTimeout(check, pollInterval);
  });
}

// ==================== 类型 ====================

interface Point {
  x: number;
  y: number;
}
type CornerPoints = [Point, Point, Point, Point];
type ScanMode = "bw" | "color" | "enhanced";

interface WorkerRequest {
  id: number;
  type: "detectCorners" | "processImage";
  imageData: ImageData;
  corners?: CornerPoints;
  mode?: ScanMode;
}

interface WorkerResponse {
  id: number;
  type: string;
  success: boolean;
  result?: any;
  error?: string;
}

// ==================== Hough 直线检测（从原始版移植） ====================

/** 将直线 θ 归一化到 [0, π/2]，ρ 相应取反 */
function normalizeLine(
  line: { rho: number; theta: number }
): { rho: number; theta: number } {
  let { rho, theta } = line;
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

/** 聚类：将相近 ρ 的直线合并为一组，每组取最高票 */
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
  // 每组取票数最高者（votes 越大越优先）
  return groups.map((g) =>
    g.reduce((a, b) => (a.votes >= b.votes ? a : b))
  );
}

/** 从 Hough 直线中选出文档的 4 条边缘线 → 求交得到 4 个角点 */
function findQuadrilateralFromLines(
  lines: Array<{ rho: number; theta: number; votes: number }>,
  w: number,
  h: number,
  clusterMult: number = 1.0
): CornerPoints | null {
  if (lines.length < 4) return null;

  // 分离为水平线（θ ≈ π/2）和垂直线（θ ≈ 0）
  const horiz: Array<{ rho: number; theta: number; votes: number }> = [];
  const vert: Array<{ rho: number; theta: number; votes: number }> = [];

  for (const line of lines) {
    const n = normalizeLine(line);
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

  // 聚类距离加大：文档场景线很多，需要更激进地合并
  const clusterDist = Math.min(w, h) * 0.08 * clusterMult;
  let hClusters = clusterLines(horiz, clusterDist);
  let vClusters = clusterLines(vert, clusterDist);

  if (hClusters.length < 2 || vClusters.length < 2) return null;

  // 只取最强的几组线（按票数降序），避免组合爆炸
  hClusters.sort((a, b) => b.votes - a.votes);
  vClusters.sort((a, b) => b.votes - a.votes);
  const maxH = Math.min(hClusters.length, 8);
  const maxV = Math.min(vClusters.length, 8);
  hClusters = hClusters.slice(0, maxH);
  vClusters = vClusters.slice(0, maxV);

  let bestCorners: CornerPoints | null = null;
  let bestScore = -Infinity;

  const minDist = Math.min(w, h) * 0.15;

  // 预生成水平线对（top < bottom）
  const hPairs: Array<{ top: typeof hClusters[0]; bottom: typeof hClusters[0] }> = [];
  for (let i = 0; i < hClusters.length; i++) {
    for (let j = i + 1; j < hClusters.length; j++) {
      if (hClusters[j].rho - hClusters[i].rho >= minDist) {
        hPairs.push({ top: hClusters[i], bottom: hClusters[j] });
      }
    }
  }

  // 预生成垂直线对（left < right）
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
  const maxHPairs = Math.min(hPairs.length, 10);
  const maxVPairs = Math.min(vPairs.length, 10);

  // 严格边界：角点必须在图像内（允许 10% 外扩）
  const marginX = w * 0.1;
  const marginY = h * 0.1;

  for (let hi = 0; hi < maxHPairs; hi++) {
    const { top, bottom } = hPairs[hi];
    for (let vi = 0; vi < maxVPairs; vi++) {
      const { left, right } = vPairs[vi];

      const tl = lineIntersection(top.rho, top.theta, left.rho, left.theta);
      const tr = lineIntersection(top.rho, top.theta, right.rho, right.theta);
      const br = lineIntersection(bottom.rho, bottom.theta, right.rho, right.theta);
      const bl = lineIntersection(bottom.rho, bottom.theta, left.rho, left.theta);
      if (!tl || !tr || !br || !bl) continue;

      // 严格检查：角点必须在图像范围内（允许小幅超出）
      if ([tl, tr, br, bl].some(p =>
        p.x < -marginX || p.x > w + marginX ||
        p.y < -marginY || p.y > h + marginY
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

/** 从边缘图中用形态学核分离方向 + HoughLinesP 检测文档角点 */
function findDocumentCornersFromHough(
  edges: any, // cv.Mat
  w: number,
  h: number
): CornerPoints | null {
  interface Seg { x1: number; y1: number; x2: number; y2: number; len: number; }
  interface LinePair { rho: number; theta: number; }

  // 用两种形态学核分别提取垂直边缘和水平边缘
  const pairs: { vLine1: LinePair; vLine2: LinePair; hLine1: LinePair; hLine2: LinePair } | null = (() => {
    const kernelBase = Math.min(w, h) * 0.06;
    const results: { dir: string; line1: LinePair; line2: LinePair }[] = [];

    for (const dir of ['vert', 'horiz'] as const) {
      // 形态学开运算：用定向核抑制文字线，保留文档长边缘
      const kLen = Math.max(3, Math.round(kernelBase));
      const kernel = dir === 'vert'
        ? cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, kLen))
        : cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kLen, 1));

      const filtered = new cv.Mat();
      cv.morphologyEx(edges, filtered, cv.MORPH_OPEN, kernel);
      kernel.delete();

      // 用 HoughLinesP 检测线段
      const lines = new cv.Mat();
      const minLineLen = Math.min(w, h) * 0.08;
      cv.HoughLinesP(filtered, lines, 1, Math.PI / 180, 25, minLineLen, 15);
      filtered.delete();

      const segs: Seg[] = [];
      for (let i = 0; i < lines.rows; i++) {
        const x1 = lines.data32S[i * 4], y1 = lines.data32S[i * 4 + 1];
        const x2 = lines.data32S[i * 4 + 2], y2 = lines.data32S[i * 4 + 3];
        const dx = x2 - x1, dy = y2 - y1;
        segs.push({ x1, y1, x2, y2, len: Math.sqrt(dx * dx + dy * dy) });
      }
      lines.delete();

      console.log(`[Worker] ${dir} kernel: ${segs.length} 条线段`);
      if (segs.length < 2) continue;

      // 按长度降序取 top N
      segs.sort((a, b) => b.len - a.len);
      const top = segs.slice(0, Math.min(segs.length, 30));

      // 聚类：按中点位置合并
      const clusterDist = Math.min(w, h) * 0.05;
      const axis = dir === 'vert' ? 'x' as const : 'y' as const;
      const sorted = [...top].sort((a, b) => {
        const mA = axis === 'x' ? (a.x1 + a.x2) / 2 : (a.y1 + a.y2) / 2;
        const mB = axis === 'x' ? (b.x1 + b.x2) / 2 : (b.y1 + b.y2) / 2;
        return mA - mB;
      });
      const clusters: Seg[] = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        const last = clusters[clusters.length - 1];
        const lastMid = axis === 'x' ? (last.x1 + last.x2) / 2 : (last.y1 + last.y2) / 2;
        const curMid = axis === 'x' ? (sorted[i].x1 + sorted[i].x2) / 2 : (sorted[i].y1 + sorted[i].y2) / 2;
        if (Math.abs(curMid - lastMid) < clusterDist) {
          if (sorted[i].len > last.len) clusters[clusters.length - 1] = sorted[i];
        } else {
          clusters.push(sorted[i]);
        }
      }

      console.log(`[Worker] ${dir} 聚类: ${clusters.length} 组`);
      if (clusters.length < 2) continue;

      // 取间距最大的线对
      let bestA = clusters[0], bestB = clusters[1], maxDist = 0;
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const midA = axis === 'x' ? (clusters[i].x1 + clusters[i].x2) / 2 : (clusters[i].y1 + clusters[i].y2) / 2;
          const midB = axis === 'x' ? (clusters[j].x1 + clusters[j].x2) / 2 : (clusters[j].y1 + clusters[j].y2) / 2;
          const d = Math.abs(midA - midB);
          if (d > maxDist) { maxDist = d; bestA = clusters[i]; bestB = clusters[j]; }
        }
      }

      // 线段转 rho/theta
      const segToLine = (s: Seg): LinePair => {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const theta = Math.atan2(dy, dx) + Math.PI / 2;
        const rho = s.x1 * Math.cos(theta) + s.y1 * Math.sin(theta);
        const n = normalizeLine({ rho, theta: ((theta % Math.PI) + Math.PI) % Math.PI });
        return { rho: n.rho, theta: n.theta };
      };

      results.push({ dir, line1: segToLine(bestA), line2: segToLine(bestB) });
    }

    const vGroup = results.find(r => r.dir === 'vert');
    const hGroup = results.find(r => r.dir === 'horiz');
    if (!vGroup || !hGroup) return null;

    return {
      vLine1: vGroup.line1, vLine2: vGroup.line2,
      hLine1: hGroup.line1, hLine2: hGroup.line2,
    };
  })();

  if (!pairs) return null;

  const tl = lineIntersection(pairs.hLine1.rho, pairs.hLine1.theta, pairs.vLine1.rho, pairs.vLine1.theta);
  const tr = lineIntersection(pairs.hLine1.rho, pairs.hLine1.theta, pairs.vLine2.rho, pairs.vLine2.theta);
  const br = lineIntersection(pairs.hLine2.rho, pairs.hLine2.theta, pairs.vLine2.rho, pairs.vLine2.theta);
  const bl = lineIntersection(pairs.hLine2.rho, pairs.hLine2.theta, pairs.vLine1.rho, pairs.vLine1.theta);

  if (!tl || !tr || !br || !bl) return null;

  // 检查角点是否在图像范围内
  const marginX = w * 0.2;
  const marginY = h * 0.2;
  if ([tl, tr, br, bl].some(p =>
    p.x < -marginX || p.x > w + marginX ||
    p.y < -marginY || p.y > h + marginY
  )) {
    console.log(`[Worker] Hough 形态学: 角点超出范围`);
    return null;
  }

  const corners = orderCorners([tl, tr, br, bl]);
  const score = scoreQuadrilateral(corners, w, h);
  console.log(`[Worker] Hough 形态学: score=${score.toFixed(3)} corners=[${corners.map(p => `(${Math.round(p.x)},${Math.round(p.y)})`).join(', ')}]`);

  return score >= 0.15 ? corners : null;
}

// ==================== 轮廓检测（兜底策略） ====================

function detectCornersFromContour(
  edges: any, // cv.Mat
  sw: number,
  sh: number,
  scale: number
): { corners: CornerPoints | null; score: number } {
  const closed = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  let bestCorners: CornerPoints | null = null;
  let bestScore = -Infinity;

  try {
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const totalArea = sw * sh;
    const minArea = totalArea * 0.005; // 至少占图像 0.5%

    const areas: Array<{ idx: number; area: number }> = [];
    for (let i = 0; i < contours.size(); i++) {
      const area = cv.contourArea(contours.get(i));
      if (area >= minArea) {
        areas.push({ idx: i, area });
      }
    }
    areas.sort((a, b) => b.area - a.area);

    const maxCheck = Math.min(areas.length, 5);
    const epsilons = [0.02, 0.03, 0.05];

    console.log(`[Worker] Contour: ${contours.size()} 个轮廓, 前${maxCheck}个面积=[${areas.slice(0, maxCheck).map(a => Math.round(a.area)).join(', ')}]`);

    for (let ci = 0; ci < maxCheck; ci++) {
      const contour = contours.get(areas[ci].idx);
      const peri = cv.arcLength(contour, true);

      for (const eps of epsilons) {
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, eps * peri, true);

        if (approx.rows === 4) {
          const pts: Point[] = [];
          for (let k = 0; k < 4; k++) {
            pts.push({
              x: approx.data32S[k * 2] / scale,
              y: approx.data32S[k * 2 + 1] / scale,
            });
          }
          const ordered = orderCorners(pts as [Point, Point, Point, Point]);
          const score = scoreQuadrilateral(ordered, sw / scale, sh / scale);
          console.log(`[Worker] Contour eps=${eps} 面积=${Math.round(areas[ci].area)}: score=${score.toFixed(3)} corners=[${ordered.map(p => `(${Math.round(p.x)},${Math.round(p.y)})`).join(', ')}]`);
          if (score > bestScore) {
            bestScore = score;
            bestCorners = ordered;
          }
        }
        approx.delete();
      }
      contour.delete();
    }
  } finally {
    closed.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
  }

  return { corners: bestCorners, score: bestScore };
}

// ==================== 亮度检测（文档通常比背景亮） ====================

function detectCornersFromBrightness(
  gray: any, // cv.Mat (灰度图)
  sw: number,
  sh: number,
  scale: number
): { corners: CornerPoints | null; score: number } {
  const totalArea = sw * sh;
  const blurred = new cv.Mat();
  const binary = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  let bestCorners: CornerPoints | null = null;
  let bestScore = -Infinity;

  try {
    // 模糊以减少文字干扰
    cv.GaussianBlur(gray, blurred, new cv.Size(21, 21), 5);

    // 尝试两种阈值方向：文档可能比背景亮或暗
    for (const invert of [false, true]) {
      cv.threshold(blurred, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      if (invert) {
        cv.bitwise_not(binary, binary);
      }

      // 形态学闭运算，合并碎片
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
      cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, kernel);
      kernel.delete();

      cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const minArea = totalArea * 0.1; // 至少占 10%
      for (let i = 0; i < contours.size(); i++) {
        const area = cv.contourArea(contours.get(i));
        if (area < minArea) continue;

        // 用 minAreaRect（最小面积矩形）获取旋转矩形
        // 手动计算 4 个顶点（cv.RotatedRect.points 在 OpenCV.js 中不可靠）
        const rect = cv.minAreaRect(contours.get(i));
        const cx = rect.center.x, cy = rect.center.y;
        const rw = rect.size.width / 2, rh = rect.size.height / 2;
        const a = rect.angle * Math.PI / 180;
        const cos = Math.cos(a), sin = Math.sin(a);

        const corners_raw = [
          { x: cx + (-rw * cos - (-rh) * sin), y: cy + (-rw * sin + (-rh) * cos) },
          { x: cx + (rw * cos - (-rh) * sin), y: cy + (rw * sin + (-rh) * cos) },
          { x: cx + (rw * cos - rh * sin), y: cy + (rw * sin + rh * cos) },
          { x: cx + (-rw * cos - rh * sin), y: cy + (-rw * sin + rh * cos) },
        ];

        const pts: Point[] = corners_raw.map(p => ({
          x: p.x / scale,
          y: p.y / scale,
        }));

        const ordered = orderCorners(pts as [Point, Point, Point, Point]);
        const score = scoreQuadrilateral(ordered, sw / scale, sh / scale);
        console.log(`[Worker] Brightness ${invert ? 'dark' : 'light'} area=${Math.round(area)}: score=${score.toFixed(3)} corners=[${ordered.map(p => `(${Math.round(p.x)},${Math.round(p.y)})`).join(', ')}]`);
        if (score > bestScore) {
          bestScore = score;
          bestCorners = ordered;
        }
      }
    }
  } finally {
    blurred.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
  }

  return { corners: bestCorners, score: bestScore };
}

// ==================== 角点检测（主入口） ====================

function detectCorners(imageData: ImageData): {
  corners: CornerPoints | null;
  width: number;
  height: number;
} {
  const w = imageData.width;
  const h = imageData.height;

  const src = cv.matFromImageData(imageData);

  // 降采样
  const maxShortSide = 800;
  let scale = 1;
  if (Math.min(w, h) > maxShortSide) {
    scale = maxShortSide / Math.min(w, h);
  }
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const small = new cv.Mat();
  cv.resize(src, small, new cv.Size(sw, sh), 0, 0, cv.INTER_AREA);

  const gray = new cv.Mat();
  cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);

  // 多组参数尝试（从原始版移植的策略）
  const blurSigmas = [1.5, 2.5, 4.0];
  const cannyPairs: Array<[number, number]> = [
    [50, 150],
    [75, 200],
    [100, 250],
  ];

  let bestCorners: CornerPoints | null = null;
  let bestScore = -Infinity;
  let bestMethod = "";

  const edges = new cv.Mat();
  const blurred = new cv.Mat();

  try {
    for (const sigma of blurSigmas) {
      // 可调高斯模糊（原始版的关键差异）
      const ksize = Math.max(3, Math.round(sigma * 2) * 2 + 1); // 确保奇数
      cv.GaussianBlur(gray, blurred, new cv.Size(ksize, ksize), sigma);

      for (const [low, high] of cannyPairs) {
        cv.Canny(blurred, edges, low, high);
        const edgeCount = cv.countNonZero(edges);

        // 策略 1：Hough 直线检测（主策略）
        const houghCorners = findDocumentCornersFromHough(edges, sw, sh);
        if (houghCorners) {
          // 将角点缩放回原始分辨率
          const invScale = 1 / scale;
          const scaledCorners: CornerPoints = houghCorners.map(p => ({
            x: Math.round(p.x * invScale),
            y: Math.round(p.y * invScale),
          })) as CornerPoints;
          const score = scoreQuadrilateral(scaledCorners, w, h);
          console.log(`[Worker] Hough sigma=${sigma} canny=[${low},${high}]: score=${score.toFixed(3)} 边缘=${edgeCount}`);
          if (score > bestScore) {
            bestScore = score;
            bestCorners = scaledCorners;
            bestMethod = `Hough(sigma=${sigma},canny=[${low},${high}])`;
          }
        }

        // 策略 2：轮廓检测（兜底）
        const contourResult = detectCornersFromContour(edges, sw, sh, scale);
        if (contourResult.corners) {
          const invScale = 1 / scale;
          const scaledCorners: CornerPoints = contourResult.corners.map(p => ({
            x: Math.round(p.x * invScale),
            y: Math.round(p.y * invScale),
          })) as CornerPoints;
          const score = scoreQuadrilateral(scaledCorners, w, h);
          console.log(`[Worker] Contour sigma=${sigma} canny=[${low},${high}]: score=${score.toFixed(3)} 边缘=${edgeCount}`);
          if (score > bestScore) {
            bestScore = score;
            bestCorners = scaledCorners;
            bestMethod = `Contour(sigma=${sigma},canny=[${low},${high}])`;
          }
        }
      }
    }
  } finally {
    // 注意：gray 还没删除，下面亮度检测还要用
    src.delete();
    small.delete();
    blurred.delete();
    edges.delete();
  }

  // 策略 3：亮度检测（文档通常比背景亮）
  const brightResult = detectCornersFromBrightness(gray, sw, sh, scale);
  gray.delete();
  if (brightResult.corners) {
    const invScale = 1 / scale;
    const scaledCorners: CornerPoints = brightResult.corners.map(p => ({
      x: Math.round(p.x * invScale),
      y: Math.round(p.y * invScale),
    })) as CornerPoints;
    const score = scoreQuadrilateral(scaledCorners, w, h);
    if (score > bestScore) {
      bestScore = score;
      bestCorners = scaledCorners;
      bestMethod = `Brightness`;
    }
  }

  if (bestCorners && bestScore >= 0.15) {
    console.log(`[Worker] 最终: ${bestMethod} score=${bestScore.toFixed(3)} area=${Math.round(polygonArea(bestCorners))}`);
  } else {
    console.log(`[Worker] 无有效候选, bestScore=${bestScore}`);
  }

  // 没有有效检测结果，或角点超出图片范围时，默认使用图片四角
  const imageCorners: CornerPoints = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];

  if (!bestCorners || bestScore < 0.15) {
    bestCorners = imageCorners;
    console.log(`[Worker] 无有效候选，使用图片四角`);
  } else if (bestCorners.some(p => p.x < 0 || p.x > w || p.y < 0 || p.y > h)) {
    bestCorners = imageCorners;
    console.log(`[Worker] 角点超出图片范围，使用图片四角`);
  }

  return {
    corners: bestCorners,
    width: w,
    height: h,
  };
}

// ==================== 透视校正 + 扫描处理 ====================

/** 将 OpenCV Mat (RGBA) 转为 ImageData（不依赖 cv.imshow） */
function matToImageData(mat: any): ImageData {
  const w = mat.cols;
  const h = mat.rows;
  const channels = mat.channels();
  const srcData = mat.data; // Uint8Array
  const imageData = new ImageData(w, h);
  const dstData = imageData.data;

  if (channels === 4) {
    // RGBA → 直接复制
    dstData.set(srcData);
  } else if (channels === 3) {
    // RGB → 插入 alpha=255
    for (let i = 0; i < w * h; i++) {
      dstData[i * 4] = srcData[i * 3];
      dstData[i * 4 + 1] = srcData[i * 3 + 1];
      dstData[i * 4 + 2] = srcData[i * 3 + 2];
      dstData[i * 4 + 3] = 255;
    }
  } else if (channels === 1) {
    // 灰度 → 复制到 RGB，alpha=255
    for (let i = 0; i < w * h; i++) {
      dstData[i * 4] = srcData[i];
      dstData[i * 4 + 1] = srcData[i];
      dstData[i * 4 + 2] = srcData[i];
      dstData[i * 4 + 3] = 255;
    }
  }

  return imageData;
}

async function processImageAsync(
  imageData: ImageData,
  corners: CornerPoints,
  mode: ScanMode
): Promise<{ pixels: ArrayBuffer; width: number; height: number }> {
  const src = cv.matFromImageData(imageData);

  const docW = Math.round(
    Math.max(dist(corners[0], corners[1]), dist(corners[3], corners[2]))
  );
  const docH = Math.round(
    Math.max(dist(corners[0], corners[3]), dist(corners[1], corners[2]))
  );

  const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    corners[0].x,
    corners[0].y,
    corners[1].x,
    corners[1].y,
    corners[2].x,
    corners[2].y,
    corners[3].x,
    corners[3].y,
  ]);
  const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    docW - 1,
    0,
    docW - 1,
    docH - 1,
    0,
    docH - 1,
  ]);

  const M = cv.getPerspectiveTransform(srcPts, dstPts);
  const dst = new cv.Mat();
  cv.warpPerspective(
    src,
    dst,
    M,
    new cv.Size(docW, docH),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar()
  );

  // 直接从 Mat 读取像素数据（不依赖 cv.imshow / HTMLCanvasElement）
  const warpedData = matToImageData(dst);

  src.delete();
  srcPts.delete();
  dstPts.delete();
  M.delete();
  dst.delete();

  // 扫描模式处理
  let finalData: ImageData;
  if (mode === "bw") {
    finalData = applyBlackAndWhite(warpedData);
  } else if (mode === "color") {
    finalData = applyColorEnhance(warpedData);
  } else {
    finalData = applyShadowRemoval(warpedData);
  }

  // 返回原始像素数据（避免依赖 OffscreenCanvas，部分手机不支持）
  return {
    pixels: finalData.data.buffer,
    width: finalData.width,
    height: finalData.height,
  };
}

// ==================== 消息处理 ====================

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type, imageData, corners, mode } = e.data;

  try {
    // 确保 OpenCV 已加载
    await loadOpenCV();

    if (type === "detectCorners") {
      const result = detectCorners(imageData);
      const response: WorkerResponse = {
        id,
        type: "detectCorners",
        success: true,
        result,
      };
      self.postMessage(response);
    } else if (type === "processImage") {
      if (!corners || !mode) {
        throw new Error("processImage 需要 corners 和 mode 参数");
      }
      const result = await processImageAsync(imageData, corners, mode);
      const response: WorkerResponse = {
        id,
        type: "processImage",
        success: true,
        result,
      };
      // 用 transferable 传递像素数据，避免拷贝
      self.postMessage(response, [result.pixels]);
    }
  } catch (err: any) {
    const response: WorkerResponse = {
      id,
      type,
      success: false,
      error: err.message || String(err),
    };
    self.postMessage(response);
  }
};

// ==================== 几何工具函数 ====================

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function orderCorners(pts: [Point, Point, Point, Point]): CornerPoints {
  let cx = 0,
    cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= 4;
  cy /= 4;

  const withAngle = pts.map((p) => ({
    p,
    angle: Math.atan2(p.y - cy, p.x - cx),
  }));
  withAngle.sort((a, b) => a.angle - b.angle);

  return [withAngle[0].p, withAngle[1].p, withAngle[2].p, withAngle[3].p];
}

function scoreQuadrilateral(
  corners: CornerPoints,
  w: number,
  h: number
): number {
  const [tl, tr, br, bl] = corners;

  const angleScore =
    (1 - angleDiff(angleBetween(bl, tl, tr), Math.PI / 2) +
      (1 - angleDiff(angleBetween(tl, tr, br), Math.PI / 2)) +
      (1 - angleDiff(angleBetween(tr, br, bl), Math.PI / 2)) +
      (1 - angleDiff(angleBetween(br, bl, tl), Math.PI / 2))) /
    4;

  const convex = isConvex(corners) ? 1 : 0.3;

  const area = polygonArea(corners);
  const areaScore = Math.min(1, area / (w * h));

  const sides = [dist(tl, tr), dist(tr, br), dist(br, bl), dist(bl, tl)];
  const avgSide = (sides[0] + sides[2]) / 2;
  const avgSide2 = (sides[1] + sides[3]) / 2;
  const aspectRatio =
    avgSide > 0 && avgSide2 > 0
      ? Math.min(avgSide, avgSide2) / Math.max(avgSide, avgSide2)
      : 0;
  const aspectScore = Math.min(1, aspectRatio * 2);

  const margin = Math.min(w, h) * 0.05;
  let boundsScore = 0;
  for (const p of [tl, tr, br, bl]) {
    const dx = Math.max(0, -p.x, p.x - w) - margin;
    const dy = Math.max(0, -p.y, p.y - h) - margin;
    if (dx > 0 || dy > 0) {
      const penalty =
        Math.sqrt(dx * dx + dy * dy) / (Math.min(w, h) * 0.3);
      boundsScore -= Math.min(0.5, penalty);
    }
  }
  const insideCount = [tl, tr, br, bl].filter(
    (p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h
  ).length;
  if (insideCount === 0) return -1;

  return (
    angleScore * 0.15 +
    areaScore * 0.50 +
    convex * 0.05 +
    aspectScore * 0.10 +
    (insideCount / 4) * 0.10 +
    boundsScore * 0.10
  );
}

function angleDiff(a: number, b: number): number {
  return Math.min(Math.abs(a - b), Math.PI - Math.abs(a - b)) / (Math.PI / 2);
}

function angleBetween(a: Point, center: Point, b: Point): number {
  const dx1 = a.x - center.x,
    dy1 = a.y - center.y;
  const dx2 = b.x - center.x,
    dy2 = b.y - center.y;
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
  let pos = 0,
    neg = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const k = (i + 2) % 4;
    const c = cross(corners[i], corners[j], corners[k]);
    if (c > 0) pos++;
    else if (c < 0) neg++;
  }
  return pos === 0 || neg === 0 || pos === 4 || neg === 4;
}

// ==================== 三种扫描模式（从 imageProcess.ts 迁移） ====================

function applyBlackAndWhite(imageData: ImageData): ImageData {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const len = w * h;

  // 灰度化 + 中值滤波
  const gray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    gray[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  const denoised = new Float32Array(len);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const vals = [
        gray[i - w - 1], gray[i - w], gray[i - w + 1],
        gray[i - 1], gray[i], gray[i + 1],
        gray[i + w - 1], gray[i + w], gray[i + w + 1],
      ];
      vals.sort((a, b) => a - b);
      denoised[i] = vals[4];
    }
  }
  for (let y = 0; y < h; y++) {
    denoised[y * w] = gray[y * w];
    denoised[y * w + w - 1] = gray[y * w + w - 1];
  }
  for (let x = 0; x < w; x++) {
    denoised[x] = gray[x];
    denoised[(h - 1) * w + x] = gray[(h - 1) * w + x];
  }

  // 对比度拉伸
  let minV = 255,
    maxV = 0;
  for (let i = 0; i < len; i++) {
    if (denoised[i] < minV) minV = denoised[i];
    if (denoised[i] > maxV) maxV = denoised[i];
  }
  const range = maxV - minV;
  if (range > 20) {
    const s = 255 / range;
    for (let i = 0; i < len; i++) {
      denoised[i] = (denoised[i] - minV) * s;
    }
  }

  // Sauvola 二值化
  const winSize = Math.max(16, Math.min(64, Math.floor(Math.min(w, h) / 8)));
  const r = Math.floor(winSize / 2);
  const sumInt = new Float64Array((w + 1) * (h + 1));
  const sumSqInt = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    const rowIntOff = (y + 1) * (w + 1);
    const prevRowIntOff = y * (w + 1);
    let rowSum = 0,
      rowSqSum = 0;
    for (let x = 0; x < w; x++) {
      const v = denoised[rowOff + x];
      rowSum += v;
      rowSqSum += v * v;
      sumInt[rowIntOff + x + 1] = sumInt[prevRowIntOff + x + 1] + rowSum;
      sumSqInt[rowIntOff + x + 1] = sumSqInt[prevRowIntOff + x + 1] + rowSqSum;
    }
  }

  const k = 0.25;
  const R = 128;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(w - 1, x + r);
      const y1 = Math.max(0, y - r);
      const y2 = Math.min(h - 1, y + r);
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
      const threshold = mean * (1 + k * (std / R - 1));
      const v = denoised[i] > threshold ? 255 : 0;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
    }
  }

  // 形态学去噪
  const binaryCopy = new Uint8Array(len);
  for (let i = 0; i < len; i++) binaryCopy[i] = data[i * 4];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (binaryCopy[i] === 0) {
        let whiteCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            if (binaryCopy[(y + dy) * w + (x + dx)] > 0) whiteCount++;
          }
        }
        if (whiteCount >= 7) {
          data[i * 4] = 255;
          data[i * 4 + 1] = 255;
          data[i * 4 + 2] = 255;
        }
      }
    }
  }

  return imageData;
}

function applyColorEnhance(imageData: ImageData): ImageData {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const len = w * h;

  const gray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    gray[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
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

  const winSize = Math.max(24, Math.floor(Math.min(w, h) / 10));
  const r = Math.floor(winSize / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;
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
      const localMean = sum / area;
      const pixelGray = gray[i];
      const diff = localMean - pixelGray;

      const textThreshold = 8;
      const smoothness = 4;
      let textConf: number;
      const raw = (diff - textThreshold) / smoothness;
      if (raw > 3) textConf = 1.0;
      else if (raw < -3) textConf = 0.0;
      else textConf = 1 / (1 + Math.exp(-raw));

      if (textConf > 0.9) {
        const darkenFactor = 0.7;
        for (let c = 0; c < 3; c++) {
          let v = data[idx + c] * darkenFactor;
          v = v * (255 / 180);
          data[idx + c] = Math.max(0, Math.min(255, Math.round(v)));
        }
      } else if (textConf > 0.1) {
        if (textConf > 0.5) {
          const darkenMix = (textConf - 0.5) * 2;
          for (let c = 0; c < 3; c++) {
            const orig = data[idx + c];
            const darkened = Math.round(orig * 0.7 * (255 / 180));
            const v = Math.round(darkened * darkenMix + orig * (1 - darkenMix));
            data[idx + c] = Math.max(0, Math.min(255, v));
          }
        } else {
          const whitenMix = 1 - textConf * 2;
          for (let c = 0; c < 3; c++) {
            const orig = data[idx + c];
            const v = Math.round(255 * (1 - whitenMix) + orig * whitenMix);
            data[idx + c] = Math.max(0, Math.min(255, v));
          }
        }
      } else {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
      }
    }
  }

  // 锐化
  for (let c = 0; c < 3; c++) {
    const src = new Uint8Array(len);
    for (let i = 0; i < len; i++) src[i] = data[i * 4 + c];
    const blurred = new Uint8Array(len);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const val =
          src[i - w - 1] + src[i - w] + src[i - w + 1] +
          src[i - 1] + src[i] + src[i + 1] +
          src[i + w - 1] + src[i + w] + src[i + w + 1];
        blurred[i] = Math.round(val / 9);
      }
    }
    for (let x = 0; x < w; x++) {
      blurred[x] = src[x];
      blurred[(h - 1) * w + x] = src[(h - 1) * w + x];
    }
    for (let y = 0; y < h; y++) {
      blurred[y * w] = src[y * w];
      blurred[y * w + w - 1] = src[y * w + w - 1];
    }
    for (let i = 0; i < len; i++) {
      const d = src[i] - blurred[i];
      if (Math.abs(d) > 8) {
        let v = Math.round(src[i] + 0.5 * d);
        data[i * 4 + c] = Math.max(0, Math.min(255, v));
      }
    }
  }

  return imageData;
}

function applyShadowRemoval(imageData: ImageData): ImageData {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const len = w * h;

  const gray = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    gray[i] =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
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

  const winSize = Math.max(32, Math.floor(Math.min(w, h) / 8));
  const r = Math.floor(winSize / 2);

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

  for (let i = 0; i < len; i++) {
    const idx = i * 4;
    const pixelGray = gray[i];
    const bgEstimate = background[i];
    const minBg = 30;
    const effectiveBg = Math.max(bgEstimate, minBg);
    const normalized = pixelGray / effectiveBg;
    const textConf = Math.max(0, Math.min(1, (1.0 - normalized) * 3.0));

    for (let c = 0; c < 3; c++) {
      const orig = data[idx + c];
      if (textConf > 0.5) {
        let reflectance = orig / effectiveBg;
        let v = reflectance * 255 * (1 - textConf * 0.4);
        v = Math.max(0, Math.min(255, Math.round(v)));
        data[idx + c] = v;
      } else if (textConf > 0.15) {
        const mix = (textConf - 0.15) / 0.35;
        const textVal = Math.round(
          Math.max(0, Math.min(255, (orig / effectiveBg) * 255 * 0.7))
        );
        const bgVal = 255;
        const v = Math.round(textVal * mix + bgVal * (1 - mix));
        data[idx + c] = Math.max(0, Math.min(255, v));
      } else {
        const whiteAmount = 0.95 + textConf * 0.5;
        const v = Math.round(255 * whiteAmount + orig * (1 - whiteAmount));
        data[idx + c] = Math.max(0, Math.min(255, v));
      }
    }
  }

  // 锐化
  for (let c = 0; c < 3; c++) {
    const src = new Uint8Array(len);
    for (let i = 0; i < len; i++) src[i] = data[i * 4 + c];
    const blurred = new Uint8Array(len);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const val =
          src[i - w - 1] + src[i - w] + src[i - w + 1] +
          src[i - 1] + src[i] + src[i + 1] +
          src[i + w - 1] + src[i + w] + src[i + w + 1];
        blurred[i] = Math.round(val / 9);
      }
    }
    for (let x = 0; x < w; x++) {
      blurred[x] = src[x];
      blurred[(h - 1) * w + x] = src[(h - 1) * w + x];
    }
    for (let y = 0; y < h; y++) {
      blurred[y * w] = src[y * w];
      blurred[y * w + w - 1] = src[y * w + w - 1];
    }
    for (let i = 0; i < len; i++) {
      const d = src[i] - blurred[i];
      if (Math.abs(d) > 6) {
        let v = Math.round(src[i] + 0.6 * d);
        data[i * 4 + c] = Math.max(0, Math.min(255, v));
      }
    }
  }

  return imageData;
}
