"use client";
import { Md } from "./material";
import { useLayoutEffect, useId, useRef, type ReactNode } from "react";
export default function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  const closing = useRef(false);
  async function dismiss() {
    const dialog = ref.current;
    if (!dialog || closing.current) return;
    closing.current = true;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.dataset.closing = "true";
      const animation = dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 160,
        easing: "ease-in",
        fill: "forwards",
      });
      try {
        await animation.finished;
      } catch {}
      onClose();
      animation.cancel();
      delete dialog.dataset.closing;
    } else onClose();
    closing.current = false;
  }
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        void dismiss();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          void dismiss();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <Md
          kind="icon-button"
          type="button"
          aria-label="닫기"
          onClick={() => void dismiss()}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </Md>
      </div>
      {children}
    </dialog>
  );
}
