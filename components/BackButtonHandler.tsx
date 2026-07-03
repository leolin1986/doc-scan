"use client";
import { useEffect } from "react";

/**
 * Capacitor Android 返回键全局处理：
 * - 有浏览器历史 → 后退
 * - 无历史记录 → 退出应用
 */
export default function BackButtonHandler() {
  useEffect(() => {
    if (!(window as any).Capacitor?.isNativePlatform) return;

    let cancelled = false;
    let listener: { remove: () => Promise<void> } | null = null;

    import("@capacitor/app").then(({ App }) => {
      if (cancelled) return;
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      }).then((l) => {
        if (cancelled) {
          l.remove();
        } else {
          listener = l;
        }
      });
    });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);

  return null;
}
