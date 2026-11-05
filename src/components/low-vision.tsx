"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Md } from "./material";

export default function LowVision() {
  const [enabled, setEnabled] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setEnabled(document.documentElement.dataset.lowVision === "true"),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <Md
      kind="icon-button"
      type="button"
      aria-label={enabled ? "일반 화면으로 전환" : "저시력자용 화면으로 전환"}
      aria-pressed={enabled}
      title={enabled ? "일반 화면으로 전환" : "저시력자용 화면으로 전환"}
      onClick={() => {
        const next = !enabled;
        document.documentElement.dataset.lowVision = String(next);
        try {
          localStorage.setItem("royalsg-low-vision", String(next));
        } catch {}
        setEnabled(next);
        router.push(next ? "/accessible" : "/");
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </Md>
  );
}
