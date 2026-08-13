"use client";

export default function AdBanner() {
  if (typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform) {
    return null;
  }

  return (
    <div className="w-full flex justify-center my-4">
      <div className="w-full max-w-4xl">
        <a
          href="https://appgallery.huawei.com/app/detail?id=com.selfdiscipline.garden"
          target="_blank"
          rel="noopener noreferrer"
          className="card flex items-center gap-4 md:gap-6 hover:shadow-md transition-shadow group"
        >
          <img
            src="/self-discipline-icon.png"
            alt="自律吧!少年"
            className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-gray-900">自律吧!少年</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                儿童自律养成
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
              任务打卡 · 农场种植 · 宠物养成 · 装扮收集
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              <span>⭐ 星星激励</span>
              <span>🏆 勋章成就</span>
              <span className="text-blue-600 font-medium group-hover:underline">
                华为应用市场免费下载 →
              </span>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}