"use client";
import { Md } from "./material";
import { useEffect, useState } from "react";
export default function Theme() {
  const [mode, setMode] = useState("light"),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const initial = requestAnimationFrame(() => {
      let initialMode = matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      try {
        const saved = JSON.parse(
          localStorage.getItem("royalsg-theme-v1") || "{}",
        );
        if (["light", "dark"].includes(saved.mode)) initialMode = saved.mode;
      } catch {}
      setMode(initialMode);
      setReady(true);
    });
    return () => cancelAnimationFrame(initial);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.style.colorScheme = mode;
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem("royalsg-theme-v1", JSON.stringify({ mode }));
    } catch {}
  }, [mode, ready]);
  return (
    <Md
      kind="icon-button"
      className="theme-toggle"
      type="button"
      data-mode={mode}
      aria-label={mode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      disabled={!ready}
      onClick={() => setMode(mode === "dark" ? "light" : "dark")}
    >
      <span className="theme-icons" aria-hidden="true">
        <svg
          className="theme-sun"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
        <svg
          className="theme-moon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
        </svg>
      </span>
    </Md>
  );
}
