"use client";
import { useEffect, useState } from "react";
import {
  applyTheme,
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from "@material/material-color-utilities";
export default function Theme() {
  const [mode, setMode] = useState("system"),
    [color, setColor] = useState("#776391"),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const initial = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("royalsg-theme-v1") || "{}",
        );
        if (["system", "light", "dark"].includes(saved.mode))
          setMode(saved.mode);
        if (/^#[0-9a-f]{6}$/i.test(saved.color)) setColor(saved.color);
      } catch {}
      setReady(true);
    });
    return () => cancelAnimationFrame(initial);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const dark = mode === "system" ? media.matches : mode === "dark";
      const theme = themeFromSourceColor(argbFromHex(color));
      applyTheme(theme, {
        target: document.documentElement,
        dark,
      });
      const surfaceTones = {
        surface: dark ? 6 : 98,
        "surface-container-lowest": dark ? 4 : 100,
        "surface-container-low": dark ? 10 : 96,
        "surface-container": dark ? 12 : 94,
        "surface-container-high": dark ? 17 : 92,
        "surface-container-highest": dark ? 22 : 90,
      };
      for (const [token, tone] of Object.entries(surfaceTones)) {
        document.documentElement.style.setProperty(
          `--md-sys-color-${token}`,
          hexFromArgb(theme.palettes.neutral.tone(tone)),
        );
      }
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    update();
    media.addEventListener("change", update);
    try {
      localStorage.setItem("royalsg-theme-v1", JSON.stringify({ mode, color }));
    } catch {}
    return () => media.removeEventListener("change", update);
  }, [mode, color, ready]);
  return (
    <details className="theme">
      <summary aria-label="테마 설정">
        ◐ <span>테마</span>
      </summary>
      <div className="theme-panel">
        <label>
          화면 모드
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="system">시스템</option>
            <option value="light">라이트</option>
            <option value="dark">다크</option>
          </select>
        </label>
        <label>
          테마 색상
          <input
            aria-label="테마 색상"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setColor("#776391");
            setMode("system");
          }}
        >
          기본 테마로
        </button>
      </div>
    </details>
  );
}
