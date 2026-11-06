"use client";
import { usePathname, useRouter } from "next/navigation";
import Home from "./home";
import { useEffect } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const preload = () => {
      for (const path of [
        "/",
        "/reserve",
        "/calendar",
        "/mypage",
        "/signup",
        "/admin",
        "/privacy",
        "/accessible",
      ])
        router.prefetch(path);
    };
    if ("requestIdleCallback" in window) {
      const idle = window.requestIdleCallback(preload);
      return () => window.cancelIdleCallback(idle);
    }
    const timer = setTimeout(preload, 1000);
    return () => clearTimeout(timer);
  }, [router]);
  useEffect(() => {
    const preventImageSave = (event: Event) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault();
    };
    document.addEventListener("contextmenu", preventImageSave);
    document.addEventListener("dragstart", preventImageSave);
    return () => {
      document.removeEventListener("contextmenu", preventImageSave);
      document.removeEventListener("dragstart", preventImageSave);
    };
  }, []);
  const pathname = usePathname();
  const panes = {
    "/": "home",
    "/accessible": "home",
    "/signup": "signup",
    "/mypage": "profile",
    "/calendar": "calendar",
    "/admin": "admin",
    "/reserve": "book",
    "/privacy": "privacy",
  } as const;
  const date = pathname.match(/^\/reserve\/(\d{4}-\d{2}-\d{2})$/)?.[1];
  const pane = date ? "book" : panes[pathname as keyof typeof panes];
  return (
    <>
      {pane ? (
        <Home pane={pane} reservationDate={date}>
          {children}
        </Home>
      ) : (
        children
      )}
    </>
  );
}
