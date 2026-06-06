/**
 * 广告位 Banner 组件
 * 上线后替换为 AdSense 或其他广告代码
 */

interface AdBannerProps {
  size: "large" | "medium" | "small";
}

const SIZE_MAP = {
  large: { w: 728, h: 90, label: "728×90" },
  medium: { w: 468, h: 60, label: "468×60" },
  small: { w: 300, h: 250, label: "300×250" },
};

export default function AdBanner({ size }: AdBannerProps) {
  const cfg = SIZE_MAP[size];

  return (
    <div className="w-full flex justify-center my-4">
      <div
        className="h-20 bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-400 border border-gray-200"
      >
        📢 广告位 ({cfg.label})
      </div>
      {/* 
        上线后替换为 AdSense:
        <ins className="adsbygoogle"
             style={{ display: 'block' }}
             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
             data-ad-slot="XXXXXXXXXX"
             data-ad-format="horizontal"
             data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
      */}
    </div>
  );
}
