"use client";

import type { ModelSpecRequirements } from "@/lib/phone-model-requirements";
import { cn } from "@/lib/utils";

const items = [
  { key: "requireColors" as const, label: "الألوان", emoji: "🎨" },
  { key: "requireStorage" as const, label: "الذاكرة الداخلية", emoji: "💾" },
  { key: "requireRam" as const, label: "الرام", emoji: "⚡" },
];

interface RequiredSpecTogglesProps {
  value: ModelSpecRequirements;
  onChange: (next: ModelSpecRequirements) => void;
}

export default function RequiredSpecToggles({ value, onChange }: RequiredSpecTogglesProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-background-input/40 p-3 space-y-2.5">
      <p className="text-xs font-bold text-white">حقول إلزامية عند إضافة الموديلات</p>
      <p className="text-[11px] text-muted leading-relaxed">
        حدّد ما يجب إدخاله لكل نوع موبايل تابع لهذه الشركة
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = value[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange({ ...value, [item.key]: !active })}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                active
                  ? "bg-primary/20 text-white border-primary/40"
                  : "bg-white/[0.03] text-muted border-border hover:text-white"
              )}
            >
              <span aria-hidden>{item.emoji}</span>
              {item.label}
              {active && <span className="text-[10px] text-primary-light">إلزامي</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
