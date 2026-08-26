"use client";

import { getModelOptionLists } from "@/lib/phone-model-options";
import type { ModelSpecRequirements } from "@/lib/phone-model-requirements";
import { cn } from "@/lib/utils";

interface ModelSpecBadgesProps {
  colors?: unknown;
  storageOptions?: unknown;
  ramOptions?: unknown;
  requirements: ModelSpecRequirements;
}

function SpecBadge({
  label,
  emoji,
  items,
  tone,
}: {
  label: string;
  emoji: string;
  items: string[];
  tone: "color" | "storage" | "ram";
}) {
  const empty = items.length === 0;

  return (
    <div className="relative group inline-flex">
      <span
        className={cn(
          "catalog-spec-badge",
          tone === "color" && "catalog-spec-badge--color",
          tone === "storage" && "catalog-spec-badge--storage",
          tone === "ram" && "catalog-spec-badge--ram",
          empty && "catalog-spec-badge--empty"
        )}
        title={empty ? "لم تُضف بعد" : items.join(" · ")}
      >
        <span aria-hidden>{emoji}</span>
        {label}
        {!empty && <span className="catalog-spec-badge__count">{items.length}</span>}
      </span>
      <div className={cn("catalog-spec-tooltip", empty && "catalog-spec-tooltip--empty")} role="tooltip">
        {empty ? "لم تُضف بعد" : items.join(" · ")}
      </div>
    </div>
  );
}

export default function ModelSpecBadges({
  colors,
  storageOptions,
  ramOptions,
  requirements,
}: ModelSpecBadgesProps) {
  const lists = getModelOptionLists({ colors, storageOptions, ramOptions });
  const showAny = requirements.requireColors || requirements.requireStorage || requirements.requireRam;

  if (!showAny) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {requirements.requireColors && (
        <SpecBadge label="ألوان" emoji="🎨" items={lists.colors} tone="color" />
      )}
      {requirements.requireStorage && (
        <SpecBadge label="مساحة" emoji="💾" items={lists.storageOptions} tone="storage" />
      )}
      {requirements.requireRam && (
        <SpecBadge label="رام" emoji="⚡" items={lists.ramOptions} tone="ram" />
      )}
    </div>
  );
}
