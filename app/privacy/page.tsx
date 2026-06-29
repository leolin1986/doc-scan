"use client";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-12 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">隐私政策</h1>

      <div className="card space-y-6 w-full">
        <p className="text-sm text-gray-500">最后更新日期：2026年6月29日</p>

        <section>
          <h2 className="font-semibold text-lg mb-2">一、概述</h2>
          <p className="text-sm text-gray-600">
            DocScan（以下简称"本应用"）是一款免费的在线文档扫描工具。我们非常重视您的隐私保护。本隐私政策旨在向您说明我们如何收集、使用和保护您的个人信息。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-2">二、信息收集</h2>
          <p className="text-sm text-gray-600">
            <strong>本应用不收集任何个人信息。</strong>
          </p>
          <p className="text-sm text-gray-600 mt-2">
            您上传或拍摄的图片仅在您的设备本地进行处理，不会上传到任何服务器。所有图像处理（包括边缘检测、透视校正、图像增强）均在浏览器/设备端完成。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-2">三、权限使用</h2>
          <p className="text-sm text-gray-600">本应用可能申请以下设备权限：</p>
          <ul className="text-sm text-gray-600 mt-2 space-y-2 list-disc list-inside">
            <li>
              <strong>相机权限（CAMERA）</strong>：用于拍摄文档照片，拍摄内容仅在本地处理，不会上传。
            </li>
            <li>
              <strong>存储权限（READ/WRITE_EXTERNAL_STORAGE）</strong>：用于读取相册图片和保存扫描结果到您的设备。
            </li>
          </ul>
          <p className="text-sm text-gray-600 mt-2">
            以上权限仅用于实现应用功能，不会用于其他目的。您可以随时在设备设置中撤销这些权限。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-2">四、数据存储</h2>
          <p className="text-sm text-gray-600">
            本应用不存储任何用户数据到服务器。所有图片处理均在本地完成，处理完成后图片仅保存在您的设备上，我们无法访问。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-2">五、第三方服务</h2>
          <p className="text-sm text-gray-600">
            本应用的网页版可能包含第三方广告（Google AdSense）。这些广告商可能使用 Cookie 或类似技术来投放广告。您可以参考 Google 的隐私政策了解详情。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-2">六、儿童隐私</h2>
          <p className="text-sm text-gray-600">
            本应用不面向 14 岁以下儿童提供服务，也不会故意收集儿童的个人信息。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-2">七、隐私政策更新</h2>
          <p className="text-sm text-gray-600">
            我们可能会不定期更新本隐私政策。更新后的隐私政策将在本页面公布，并注明更新日期。建议您定期查看本页面。
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-2">八、联系我们</h2>
          <p className="text-sm text-gray-600">
            如果您对本隐私政策有任何疑问，可以通过以下方式联系我们：
          </p>
          <p className="text-sm text-gray-600 mt-2">
            开发者：梁林
          </p>
          <p className="text-sm text-gray-600 mt-2">
            邮箱：blackboy007pp@hotmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
