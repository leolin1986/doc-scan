"use client";

export default function AdBanner() {
  if (typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform) {
    return null;
  }

  return (
    <div className="w-full flex justify-center my-4">
      <div className="w-full max-w-4xl">
        <iframe
          data-aa="2442668"
          src="https://acceptable.a-ads.com/2442668/?size=Adaptive"
          style={{ border: 0, width: "100%", height: "auto", overflow: "hidden", display: "block" }}
          title="广告"
        />
      </div>
    </div>
  );
}
