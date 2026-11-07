import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import AppShell from "@/components/app-shell";
export const metadata: Metadata = {
  title: "로얄상구 · 기기 예약",
  description: "로얄상구 밤샘 기기 대여 예약 서비스",
  icons: {
    icon: "/app-icon?size=192&purpose=any&v=4",
    apple: "/app-icon?size=192&purpose=maskable&v=4",
  },
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const preference=localStorage.getItem("royalsg-low-vision");const accessible=preference==="true"||(preference===null&&location.pathname==="/accessible");const theme=JSON.parse(localStorage.getItem("royalsg-theme-v1")||"{}").mode;document.documentElement.dataset.theme=theme==="dark"||theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.lowVision=String(accessible);if(accessible)localStorage.setItem("royalsg-low-vision","true");document.documentElement.dataset.introSeen=accessible||sessionStorage.getItem("royalsg-intro")||matchMedia("(prefers-reduced-motion: reduce)").matches?"true":"false"}catch{document.documentElement.dataset.introSeen="false"}`,
          }}
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <SpeedInsights />
      </body>
    </html>
  );
}
