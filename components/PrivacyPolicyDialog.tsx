"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";

const STORAGE_KEY = "privacy_agreed";

export default function PrivacyPolicyDialog() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  const handleAgree = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const handleReject = async () => {
    localStorage.removeItem(STORAGE_KEY);
    try {
      const { App } = await import("@capacitor/app");
      App.exitApp();
    } catch {
      // Web 环境无法退出，弹窗保持显示
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-[90%] max-h-[85vh] flex flex-col p-6">
        <h2 className="text-lg font-bold mb-3 shrink-0">{t("privacy.title")}</h2>

        {!expanded ? (
          <>
            <p className="text-sm text-gray-600 mb-4">{t("privacy.intro")}</p>
            <button
              onClick={() => setExpanded(true)}
              className="text-sm text-blue-600 underline mb-4 text-left"
            >
              {t("privacy.link")}
            </button>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto mb-4 text-sm text-gray-600 space-y-4 pr-1">
            <p className="text-xs text-gray-400">最后更新日期：2026年6月29日</p>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">一、概述</h3>
              <p>扫立得（以下简称"本应用"）是一款免费的在线文档扫描工具。我们非常重视您的隐私保护。本隐私政策旨在向您说明我们如何收集、使用和保护您的个人信息。</p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">二、信息收集</h3>
              <p><strong>本应用不收集任何个人信息。</strong></p>
              <p className="mt-1">您上传或拍摄的图片仅在您的设备本地进行处理，不会上传到任何服务器。所有图像处理（包括边缘检测、透视校正、图像增强）均在浏览器/设备端完成。</p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">三、权限使用</h3>
              <p>本应用可能申请以下设备权限：</p>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li><strong>相机权限（CAMERA）</strong>：用于拍摄文档照片，拍摄内容仅在本地处理，不会上传。</li>
                <li><strong>存储权限（READ/WRITE_EXTERNAL_STORAGE）</strong>：用于读取相册图片和保存扫描结果到您的设备。</li>
              </ul>
              <p className="mt-1">以上权限仅用于实现应用功能，不会用于其他目的。您可以随时在设备设置中撤销这些权限。</p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">四、数据存储</h3>
              <p>本应用不存储任何用户数据到服务器。所有图片处理均在本地完成，处理完成后图片仅保存在您的设备上，我们无法访问。</p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">五、第三方服务</h3>
              <p>本应用的网页版可能包含第三方广告（Google AdSense）。这些广告商可能使用 Cookie 或类似技术来投放广告。您可以参考 Google 的隐私政策了解详情。</p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">六、儿童隐私</h3>
              <p>本应用不面向 14 岁以下儿童提供服务，也不会故意收集儿童的个人信息。</p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">七、隐私政策更新</h3>
              <p>我们可能会不定期更新本隐私政策。更新后的隐私政策将在本页面公布，并注明更新日期。建议您定期查看本页面。</p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-800 mb-1">八、联系我们</h3>
              <p>如果您对本隐私政策有任何疑问，可以通过以下方式联系我们：</p>
              <p className="mt-1">开发者：梁林</p>
              <p>邮箱：blackboy007pp@hotmail.com</p>
            </section>
          </div>
        )}

        <div className="shrink-0">
          <label className="flex items-start gap-2 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span className="text-sm text-gray-700">{t("privacy.agree")}</span>
          </label>

          <button
            onClick={handleAgree}
            disabled={!checked}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium text-sm
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            {t("privacy.confirm")}
          </button>

          <button
            onClick={handleReject}
            className="w-full py-3 mt-2 rounded-lg text-gray-500 font-medium text-sm
                       hover:text-gray-700 transition-colors"
          >
            {t("privacy.reject")}
          </button>
        </div>
      </div>
    </div>
  );
}
