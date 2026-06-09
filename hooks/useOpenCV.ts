"use client";
import { useState, useEffect } from "react";
import { getOpenCV } from "@/utils/opencvLoader";

interface OpenCVState {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useOpenCV() {
  const [state, setState] = useState<OpenCVState>({
    isReady: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // 不自动加载，等用户触发扫描时再加载
    // 通过返回的 load() 手动触发
  }, []);

  const load = async () => {
    if (state.isReady || state.isLoading) return;
    setState({ isReady: false, isLoading: true, error: null });
    try {
      await getOpenCV();
      setState({ isReady: true, isLoading: false, error: null });
    } catch (err: any) {
      setState({
        isReady: false,
        isLoading: false,
        error: err.message || "OpenCV 加载失败",
      });
    }
  };

  return { ...state, load };
}
