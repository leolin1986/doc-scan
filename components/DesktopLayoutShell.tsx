"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivacyPolicyDialog from "@/components/PrivacyPolicyDialog";
import FeedbackButton from "@/components/FeedbackButton";
import AnalyticsScript from "@/app/AnalyticsScript";

const isCapacitor = process.env.CAPACITOR_BUILD === "true";

export default function DesktopLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWechat = pathname.startsWith("/wechat");

  return (
    <>
      {!isWechat && (
        <>
          <PrivacyPolicyDialog />
          <Header />
        </>
      )}
      <main className="flex-1">{children}</main>
      {!isWechat && !isCapacitor && <FeedbackButton />}
      {!isWechat && <Footer />}
      {!isWechat && !isCapacitor && <AnalyticsScript />}
    </>
  );
}