import { deviceConditionLabel } from "@/lib/phone-device-display";

export function PhoneConditionBadge({
  condition,
  className = "",
}: {
  condition?: string | null;
  className?: string;
}) {
  const isUsed = condition === "used";
  const label = deviceConditionLabel(condition);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold leading-none ${
        isUsed
          ? "border-amber-400/35 bg-amber-400/15 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)]"
          : "border-emerald-400/35 bg-emerald-400/15 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.12)]"
      } ${className}`}
    >
      {label}
    </span>
  );
}

export function ProductTypeWithCondition({
  type,
  typeLabel,
  deviceCondition,
  typeClassName = "text-sm text-muted",
}: {
  type: string;
  typeLabel: string;
  deviceCondition?: string | null;
  typeClassName?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className={typeClassName}>{typeLabel}</span>
      {type === "phone" ? <PhoneConditionBadge condition={deviceCondition} /> : null}
    </div>
  );
}

export function ProductMetaTypeLine({
  type,
  typeLabel,
  brand,
  deviceCondition,
}: {
  type: string;
  typeLabel: string;
  brand: string;
  deviceCondition?: string | null;
}) {
  return (
    <div className="text-xs text-muted mt-1 space-y-1.5">
      <p>
        {brand} · {typeLabel}
      </p>
      {type === "phone" ? <PhoneConditionBadge condition={deviceCondition} /> : null}
    </div>
  );
}
