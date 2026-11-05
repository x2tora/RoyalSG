import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "로얄상구 · 기기 예약",
  description: "로얄상구 밤샘 기기 대여 예약 서비스",
  icons: { icon: "/logo.png", apple: "/app-icon?size=192" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "로얄상구", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffbff" },
    { media: "(prefers-color-scheme: dark)", color: "#171319" },
  ],
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
