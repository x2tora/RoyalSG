import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://royalsg.xitora.cc";
  return {
    id: "/",
    name: "로얄상구 기기 예약 서비스",
    short_name: "로얄상구",
    description: "대여 잠정 중단 · 현재 실제 예약을 받지 않습니다.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#171319",
    theme_color: "#715b88",
    prefer_related_applications: false,
    related_applications: [
      {
        platform: "webapp",
        url: "/manifest.webmanifest",
        id: new URL("/", origin).href,
      },
    ],
    icons: [
      {
        src: "/app-icon?size=192&purpose=any&v=4",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon?size=512&purpose=any&v=4",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon?size=512&purpose=maskable&v=4",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
