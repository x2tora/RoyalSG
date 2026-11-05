"use client";
import { createElement, useEffect, useRef, type ReactNode } from "react";
export function MaterialLoader() {
  useEffect(() => {
    void Promise.all([
      import("@material/web/iconbutton/icon-button.js"),
      import("@material/web/iconbutton/outlined-icon-button.js"),
      import("@material/web/button/filled-button.js"),
      import("@material/web/button/outlined-button.js"),
      import("@material/web/button/text-button.js"),
      import("@material/web/textfield/outlined-text-field.js"),
      import("@material/web/checkbox/checkbox.js"),
      import("@material/web/select/outlined-select.js"),
      import("@material/web/select/select-option.js"),
    ]);
  }, []);
  return null;
}
export function TextField({
  label,
  value,
  onValue,
  ...props
}: {
  label: string;
  value?: string;
  onValue?: (value: string) => void;
  [key: string]: unknown;
}) {
  return (
    <Md
      kind="outlined-text-field"
      label={label}
      value={value}
      {...props}
      onInput={(event: Event) =>
        onValue?.((event.currentTarget as HTMLInputElement).value)
      }
    />
  );
}
export function Checkbox({
  label,
  checked,
  onChecked,
  ...props
}: {
  label: string;
  checked: boolean;
  onChecked: (checked: boolean) => void;
  [key: string]: unknown;
}) {
  return (
    <Md
      kind="checkbox"
      touch-target="wrapper"
      aria-label={label}
      checked={checked}
      {...props}
      onChange={(event: Event) =>
        onChecked((event.currentTarget as HTMLInputElement).checked)
      }
    />
  );
}
export function Select({
  label,
  value,
  onValue,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onValue: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const ref = useRef<HTMLElement & { value: string }>(null);
  useEffect(() => {
    let active = true;
    void customElements.whenDefined("md-outlined-select").then(() => {
      if (active && ref.current) ref.current.value = value;
    });
    return () => {
      active = false;
    };
  }, [value]);
  return (
    <Md
      kind="outlined-select"
      ref={ref}
      label={label}
      aria-label={label}
      disabled={disabled}
      menu-positioning="popover"
      quick
      onChange={(event: Event) =>
        onValue((event.currentTarget as HTMLSelectElement).value)
      }
    >
      {options.map((option) => (
        <Md
          kind="select-option"
          key={option.value}
          value={option.value}
          selected={option.value === value}
        >
          <div slot="headline">{option.label}</div>
        </Md>
      ))}
    </Md>
  );
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
