/**
 * OpenCV.js 单例加载器
 * 通过轮询 cv.Mat 检测 WASM 是否就绪（兼容所有初始化模式）
 */

let cvReady = false;
let cvModule: any = null;
let loadPromise: Promise<any> | null = null;

const OPENCV_URL = "/opencv/opencv.js";
const LOAD_TIMEOUT = 60000;
const POLL_INTERVAL = 100;

export function getOpenCV(): Promise<any> {
  if (cvReady && cvModule) return Promise.resolve(cvModule);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OpenCV.js 仅支持浏览器环境"));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error("OpenCV.js 加载超时（60s），请检查网络连接"));
    }, LOAD_TIMEOUT);

    function finish(cv: any) {
      clearTimeout(timeout);
      cvModule = cv;
      cvReady = true;
      console.log("[OpenCV] 就绪");
      resolve(cv);
    }

    // 已经就绪
    if ((window as any).cv?.Mat) {
      finish((window as any).cv);
      return;
    }

    // 等待 WASM 初始化完成（轮询 cv.Mat）
    function waitForReady() {
      const cv = (window as any).cv;
      if (cv?.Mat) {
        finish(cv);
      } else {
        setTimeout(waitForReady, POLL_INTERVAL);
      }
    }

    // script 已加载（cv 对象存在但 Mat 还没有）
    if ((window as any).cv) {
      console.log("[OpenCV] script 已加载，等待 WASM 初始化...");
      waitForReady();
      return;
    }

    // 首次加载
    const script = document.createElement("script");
    script.src = OPENCV_URL;
    script.async = true;

    script.onload = () => {
      console.log("[OpenCV] script 加载完成, cv 类型:", typeof (window as any).cv);
      waitForReady();
    };

    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("OpenCV.js 加载失败，请检查网络连接"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isOpenCVReady(): boolean {
  return cvReady;
}
