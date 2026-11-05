"use client";
import { createElement, useEffect, type ReactNode } from "react";
export function MaterialLoader() {
  useEffect(() => {
    void Promise.all([
      import("@material/web/button/filled-button.js"),
      import("@material/web/button/outlined-button.js"),
      import("@material/web/button/text-button.js"),
      import("@material/web/textfield/outlined-text-field.js"),
      import("@material/web/checkbox/checkbox.js"),
    ]);
  }, []);
  return null;
}
export function Md({
  kind = "filled-button",
  children,
  ...props
}: {
  kind?: string;
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return createElement("md-" + kind, props, children);
}
