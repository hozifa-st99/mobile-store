"use client";

import { useEffect, useRef, useState } from "react";

import { LogoDisplay } from "@/components/ui/LogoUpload";
import { cn } from "@/lib/utils";

export interface BrandSelectOption {
  key: string;
  nameAr: string;
  logoUrl?: string | null;
}

interface BrandSelectProps {
  options: BrandSelectOption[];
  value: string | null;
  onChange: (key: string) => void;
  placeholder?: string;
}

export default function BrandSelect({
  options,
  value,
  onChange,
  placeholder = "اختر الشركة",
}: BrandSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.key === value);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "catalog-brand-select-trigger catalog-control w-full flex items-center gap-3 rounded-lg px-3 text-right transition-colors",
          open && "border-[#6339f9]/40"
        )}
      >
        {selected ? (
          <LogoDisplay url={selected.logoUrl} name={selected.nameAr} size="xs" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-[#141721] border border-white/[0.04]" />
        )}
        <span className="flex-1 text-sm text-white truncate">{selected?.nameAr ?? placeholder}</span>
        <span className=" inline-flex items-center justify-center text-lg leading-none" title="ChevronDown">🔽</span>
      </button>

      {open && (
        <div className="catalog-brand-select-menu absolute top-[calc(100%+6px)] left-0 right-0 z-30 max-h-64 overflow-y-auto">
          {options.map((opt) => {
            const active = value === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors",
                  active ? "bg-[#6339f9]/15" : "hover:bg-white/[0.03]"
                )}
              >
                <LogoDisplay url={opt.logoUrl} name={opt.nameAr} size="xs" />
                <span className="flex-1 text-sm text-white truncate">{opt.nameAr}</span>
                {active && <span className="w-4 h-4 text-[#a78bfa] flex-shrink-0 inline-flex items-center justify-center text-lg leading-none" title="Check">✅</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
