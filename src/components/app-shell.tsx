"use client";
import { usePathname } from "next/navigation";
import Home from "./home";
import { useEffect } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
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
  } as const;
  const date = pathname.match(/^\/reserve\/(\d{4}-\d{2}-\d{2})$/)?.[1];
  const pane = date ? "book" : panes[pathname as keyof typeof panes];
  return (
    <>
      {pane ? <Home pane={pane} reservationDate={date} /> : null}
      {children}
    </>
  );
}
