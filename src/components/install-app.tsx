"use client";
import { useEffect, useRef, useState } from "react";
import Modal from "./dialog";
import { Md } from "./material";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type RelatedNavigator = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<
    { platform?: string; url?: string; id?: string }[]
  >;
};
export default function InstallApp({ ready }: { ready: boolean }) {
  const [installed, setInstalled] = useState(false),
    [nativeSupported, setNativeSupported] = useState(false),
    [ios, setIos] = useState(false),
    [available, setAvailable] = useState(false),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const deferred = useRef<InstallEvent | null>(null),
    promptSeen = useRef(false),
    installationObserved = useRef(false);
  useEffect(() => {
    const nav = navigator as RelatedNavigator;
    const standalone = matchMedia("(display-mode: standalone)");
    let active = true;
    const detect = async () => {
      let found =
        installationObserved.current ||
        standalone.matches ||
        nav.standalone === true;
      if (!found && nav.getInstalledRelatedApps) {
        try {
          const apps = await nav.getInstalledRelatedApps();
          found = apps.some(
            (app) =>
              app.platform === "webapp" &&
              (app.id === new URL("/", location.origin).href ||
                (app.url &&
                  new URL(app.url, location.origin).href ===
                    new URL("/manifest.webmanifest", location.origin).href)),
          );
        } catch {}
      }
      if (active) setInstalled(found);
    };
    const initial = requestAnimationFrame(() => {
      const isIos =
        /iPad|iPhone|iPod/.test(nav.userAgent) ||
        (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
      setIos(
        isIos &&
          /Safari/.test(nav.userAgent) &&
          !/CriOS|FxiOS|EdgiOS|OPiOS/.test(nav.userAgent),
      );
      void detect();
    });
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferred.current = event as InstallEvent;
      installationObserved.current = false;
      setInstalled(false);
      setNativeSupported(true);
      setAvailable(true);
      setMessage("");
    };
    const onInstalled = () => {
      installationObserved.current = true;
      deferred.current = null;
      setInstalled(true);
      setAvailable(false);
      setOpen(false);
      setBusy(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    standalone.addEventListener("change", detect);
    window.addEventListener("focus", detect);
    if ("serviceWorker" in navigator && window.isSecureContext)
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    return () => {
      active = false;
      cancelAnimationFrame(initial);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", detect);
      window.removeEventListener("focus", detect);
    };
  }, []);
  useEffect(() => {
    if (!ready || installed || (!available && !ios)) return;
    const recommend = () => {
      if (promptSeen.current || document.querySelector("dialog[open]")) return;
      try {
        if (localStorage.getItem("royalsg-install-prompt-v1")) return;
        localStorage.setItem("royalsg-install-prompt-v1", "1");
      } catch {}
      promptSeen.current = true;
      setOpen(true);
    };
    const initial = requestAnimationFrame(recommend);
    const onClose = () => requestAnimationFrame(recommend);
    document.addEventListener("close", onClose, true);
    return () => {
      cancelAnimationFrame(initial);
      document.removeEventListener("close", onClose, true);
    };
  }, [ready, available, ios, installed]);
  async function install() {
    const event = deferred.current;
    if (!event) {
      setOpen(true);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await event.prompt();
      const choice = await event.userChoice;
      deferred.current = null;
      setAvailable(false);
      setOpen(false);
      if (choice.outcome === "dismissed")
        setMessage("브라우저 메뉴에서도 앱을 설치할 수 있습니다.");
    } catch {
      setMessage(
        "설치 안내를 열지 못했습니다. 브라우저 메뉴에서 앱 설치를 선택해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!installed && !nativeSupported && !ios) return null;
  return (
    <>
      <div className="install-app">
        <Md
          kind="outlined-button"
          type="button"
          disabled={installed || busy}
          onClick={() => {
            setMessage("");
            if (available) void install();
            else setOpen(true);
          }}
        >
          {installed ? "설치됨" : "앱 설치"}
        </Md>
        {message ? (
          <p role="status" className="caption">
            {message}
          </p>
        ) : null}
      </div>
      {open && !installed ? (
        <Modal title="로얄상구 앱 설치" onClose={() => !busy && setOpen(false)}>
          {ios ? (
            <p>
              Safari의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해 주세요.
              ‘추가’를 누르면 홈 화면에서 로얄상구를 실행할 수 있습니다.
            </p>
          ) : available ? (
            <p>로얄상구를 앱으로 설치하시겠습니까?</p>
          ) : (
            <p>
              브라우저 메뉴에서 ‘앱 설치’ 또는 ‘로얄상구 설치’를 선택해 주세요.
            </p>
          )}
          {message ? (
            <p role="alert" className="error">
              {message}
            </p>
          ) : null}
          <div className="dialog-actions">
            <Md
              kind="text-button"
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {available ? "나중에" : "확인"}
            </Md>
            {available ? (
              <Md type="button" disabled={busy} onClick={() => void install()}>
                설치
              </Md>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
