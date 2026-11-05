"use client";
import { usePathname } from "next/navigation";
import Home from "@/components/home";

export default function ReserveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const date = pathname.match(/^\/reserve\/(\d{4}-\d{2}-\d{2})$/)?.[1];
  return (
    <>
      <Home pane="book" reservationDate={date} />
      {children}
    </>
  );
}
