/**
 * 广告位 Banner 组件
 */

interface AdBannerProps {
  size?: "large" | "medium" | "small";
}

export default function AdBanner({ size = "large" }: AdBannerProps) {
  return (
    <div className="w-full flex justify-center my-4">
      <div id="frame" style={{ width: "100%", margin: "auto", position: "relative", zIndex: 99998 }}>
        <iframe
          data-aa="2442668"
          src="//acceptable.a-ads.com/2442668/?size=Adaptive"
          style={{ border: 0, padding: 0, width: "70%", height: "auto", overflow: "hidden", display: "block", margin: "auto" }}
          title="广告"
        />
      </div>
    </div>
  );
}
