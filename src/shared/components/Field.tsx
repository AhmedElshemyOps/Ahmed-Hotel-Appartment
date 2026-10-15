import React from "react";
const input = "w-full rounded border border-slate-600 bg-slate-950 p-2";
export function Field({
  label,
  value,
  onChange,
  type = "text",
  labelClassName,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  labelClassName?: string;
}) {
  return (
    <label className={labelClassName}>
      {label}
      <input
        aria-label={label}
        className={input}
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
