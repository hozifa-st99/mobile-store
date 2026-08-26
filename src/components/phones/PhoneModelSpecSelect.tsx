"use client";

import { getModelOptionLists } from "@/lib/phone-model-options";
import type { ModelSpecRequirements } from "@/lib/phone-model-requirements";

interface PhoneModelLike {
  colors?: unknown;
  storageOptions?: unknown;
  ramOptions?: unknown;
}

interface PhoneModelSpecSelectProps {
  model?: PhoneModelLike | null;
  color: string;
  storage: string;
  ram: string;
  requirements?: ModelSpecRequirements;
  onChange: (next: { color?: string; storage?: string; ram?: string }) => void;
  className?: string;
}

export default function PhoneModelSpecSelect({
  model,
  color,
  storage,
  ram,
  requirements = { requireColors: false, requireStorage: false, requireRam: false },
  onChange,
  className,
}: PhoneModelSpecSelectProps) {
  const { colors, storageOptions, ramOptions } = getModelOptionLists(model);

  if (!model) return null;

  const showColor = requirements.requireColors && colors.length > 0;
  const showStorage = requirements.requireStorage && storageOptions.length > 0;
  const showRam = requirements.requireRam && ramOptions.length > 0;
  const hasAny = showColor || showStorage || showRam;

  const missingRequired =
    (requirements.requireColors && colors.length === 0) ||
    (requirements.requireStorage && storageOptions.length === 0) ||
    (requirements.requireRam && ramOptions.length === 0);

  if (!hasAny) {
    if (missingRequired) {
      return (
        <p className="text-xs text-accent-orange">
          مواصفات إلزامية غير مُعدّة لهذا الموديل — راجع الإعدادات.
        </p>
      );
    }
    return null;
  }

  const visibleCount = [showColor, showStorage, showRam].filter(Boolean).length;
  const gridClass =
    visibleCount === 1
      ? "grid grid-cols-1 gap-3"
      : visibleCount === 2
        ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
        : "grid grid-cols-1 sm:grid-cols-3 gap-3";

  return (
    <div className={className ?? gridClass}>
      {showColor && (
        <div>
          <label className="block text-xs text-muted mb-1.5">اللون *</label>
          <select
            value={color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="glass-input text-sm"
          >
            <option value="">— اختر —</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
      {showStorage && (
        <div>
          <label className="block text-xs text-muted mb-1.5">المساحة *</label>
          <select
            value={storage}
            onChange={(e) => onChange({ storage: e.target.value })}
            className="glass-input text-sm"
          >
            <option value="">— اختر —</option>
            {storageOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
      {showRam && (
        <div>
          <label className="block text-xs text-muted mb-1.5">الرام *</label>
          <select
            value={ram}
            onChange={(e) => onChange({ ram: e.target.value })}
            className="glass-input text-sm"
          >
            <option value="">— اختر —</option>
            {ramOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
