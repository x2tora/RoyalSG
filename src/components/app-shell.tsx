"use client";
import { usePathname } from "next/navigation";
import Home from "./home";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const panes = {
    "/": "home",
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
