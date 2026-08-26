"use client";

import type { ReactNode } from "react";

export function ClearFilterButton({ onClick, label = "مسح" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border text-base text-muted transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
    >
      <span aria-hidden>❌</span>
    </button>
  );
}

export function ClearableInput({
  value,
  onChange,
  onClear,
  placeholder,
  className,
  inputClassName,
  inputMode = "numeric",
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  inputMode?: "numeric" | "search" | "text";
}) {
  return (
    <div className={`relative min-w-0 ${className ?? ""}`}>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={
          inputClassName ??
          `glass-input w-full text-sm ${value ? "pl-10" : ""}`
        }
      />
      {value ? (
        <span className="absolute left-2 top-1/2 -translate-y-1/2">
          <ClearFilterButton onClick={onClear} />
        </span>
      ) : null}
    </div>
  );
}

export function ClearableDateInput({
  value,
  onChange,
  onClear,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className ?? ""}`}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`glass-input w-full ${value ? "pl-10" : ""}`}
      />
      {value ? (
        <span className="absolute left-2 top-1/2 -translate-y-1/2">
          <ClearFilterButton onClick={onClear} label="مسح التاريخ" />
        </span>
      ) : null}
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  onClear,
  className,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className ?? ""}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background-input border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-primary/50 min-w-0 flex-1"
      >
        {children}
      </select>
      {value ? <ClearFilterButton onClick={onClear} /> : null}
    </div>
  );
}

export function FilterSelectWithLabel({
  value,
  onChange,
  onClear,
  className,
  selectClassName,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
  selectClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex items-center gap-1.5 min-w-0 ${className ?? ""}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          selectClassName ??
          "bg-background-input border border-border rounded-xl px-4 py-2.5 text-sm text-muted focus:outline-none focus:border-primary/50 min-w-[140px] flex-1"
        }
      >
        {children}
      </select>
      {value ? <ClearFilterButton onClick={onClear} /> : null}
    </div>
  );
}
