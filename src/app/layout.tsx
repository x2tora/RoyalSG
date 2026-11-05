import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "로얄상구 · 기기 예약",
  description: "로얄상구 밤샘 기기 대여 예약 서비스",
  icons: { icon: "/logo.png" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
