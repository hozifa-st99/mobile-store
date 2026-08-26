"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import { LogoDisplay } from "@/components/ui/LogoUpload";
import { em } from "@/components/ui/TableEmoji";
import { PhoneConditionBadge } from "@/components/products/PhoneConditionBadge";
import { apiJson } from "@/lib/api-client";
import type {
  CatalogAvailabilityPayload,
  CatalogLeafAvailability,
  ItemCatalogAvailabilityCategory,
  PhoneCatalogAvailabilityEntry,
  PhoneCatalogAvailabilityModel,
} from "@/lib/catalog-availability";
import type {
  CatalogAvailabilitySerialUnit,
  CatalogAvailabilitySerialsPayload,
} from "@/lib/catalog-availability-serials";
import { cn, formatCurrency } from "@/lib/utils";
import { sortCatalogEntriesByBrandPriority, sortPhoneCatalogEntries } from "@/lib/catalog-brand-sort";

type CatalogKind = "phone" | "accessory";

interface CatalogAvailabilityModalProps {
  open: boolean;
  onClose: () => void;
  /** فرع مرجعي لـ «متوفر هنا» — مفيد قبل اختيار الفرع */
  referenceBranchId?: string | null;
  referenceHint?: string | null;
}

type PhoneLeaf = PhoneCatalogAvailabilityEntry["models"][number] & {
  groupName: string;
  groupKey: string;
  groupLogoUrl: string | null;
};

type AccessoryLeaf = ItemCatalogAvailabilityCategory["brands"][number]["names"][number] & {
  categoryName: string;
  categoryId: string;
  categoryLogoUrl: string | null;
  brandName: string;
  brandId: string;
  brandLogoUrl: string | null;
};

function CatalogNavCard({
  name,
  logoUrl,
  badge,
  subtitle,
  onClick,
  accent = "violet",
}: {
  name: string;
  logoUrl?: string | null;
  badge: string;
  subtitle: string;
  onClick: () => void;
  accent?: "violet" | "cyan" | "teal";
}) {
  const accentClasses = {
    violet: "border-violet-400/25 from-violet-600/15 hover:border-violet-300/45",
    cyan: "border-cyan-400/25 from-cyan-600/15 hover:border-cyan-300/45",
    teal: "border-teal-400/25 from-teal-600/15 hover:border-teal-300/45",
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-gradient-to-br to-transparent p-4 text-right transition-all hover:shadow-glow-sm w-full",
        accentClasses
      )}
    >
      <div className="flex items-center gap-3">
        <LogoDisplay url={logoUrl} name={name} size="lg" className="ring-2 ring-white/10 shadow-glow-sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-white truncate">{name}</p>
            <span className="text-[10px] rounded-full px-2 py-0.5 bg-white/10 text-muted shrink-0">
              {badge}
            </span>
          </div>
          <p className="text-xs text-muted mt-1">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

function CatalogSectionBanner({
  name,
  logoUrl,
  subtitle,
}: {
  name: string;
  logoUrl?: string | null;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent px-4 py-3">
      <LogoDisplay url={logoUrl} name={name} size="md" className="ring-2 ring-white/10" />
      <div className="min-w-0">
        <p className="font-bold text-white truncate">{name}</p>
        {subtitle ? <p className="text-xs text-muted mt-0.5">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function AvailabilityPills({
  availability,
  currentBranchName,
  compact = false,
  onCurrentBranchClick,
  onOtherBranchesClick,
}: {
  availability: CatalogLeafAvailability;
  currentBranchName: string;
  compact?: boolean;
  onCurrentBranchClick?: () => void;
  onOtherBranchesClick?: () => void;
}) {
  const { currentBranchQty, totalOtherQty, otherBranches } = availability;

  if (!availability.hasAnyStock) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-red-400/35 bg-red-500/15 text-red-200 font-semibold",
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
        )}
      >
        <span aria-hidden>{em.warning}</span>
        غير متاح
      </span>
    );
  }

  const currentClassName = cn(
    "inline-flex items-center gap-1 rounded-full border font-semibold transition-colors",
    currentBranchQty > 0
      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
      : "border-white/15 bg-white/5 text-muted",
    compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
    currentBranchQty > 0 && onCurrentBranchClick && "hover:bg-emerald-500/30 cursor-pointer"
  );

  const otherClassName = cn(
    "inline-flex items-center gap-1 rounded-full border border-sky-400/40 bg-sky-500/20 text-sky-100 font-semibold transition-colors",
    compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
    onOtherBranchesClick && "hover:bg-sky-500/30 cursor-pointer"
  );

  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}>
      {onCurrentBranchClick && currentBranchQty > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCurrentBranchClick();
          }}
          className={currentClassName}
          title={`${currentBranchName} — اضغط لعرض IMEI والأسعار`}
        >
          <span aria-hidden>{em.branch}</span>
          {`${currentBranchQty} هنا`}
        </button>
      ) : (
        <span className={currentClassName} title={currentBranchName}>
          <span aria-hidden>{em.branch}</span>
          {currentBranchQty > 0 ? `${currentBranchQty} هنا` : "لا يوجد هنا"}
        </span>
      )}
      {totalOtherQty > 0 ? (
        onOtherBranchesClick ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOtherBranchesClick();
            }}
            className={otherClassName}
            title={`${otherBranches.map((b) => `${b.branchName}: ${b.quantity}`).join(" · ")} — اضغط لعرض IMEI والأسعار`}
          >
            <span aria-hidden>{em.link}</span>
            {totalOtherQty} بفروع أخرى
          </button>
        ) : (
          <span
            className={otherClassName}
            title={otherBranches.map((b) => `${b.branchName}: ${b.quantity}`).join(" · ")}
          >
            <span aria-hidden>{em.link}</span>
            {totalOtherQty} بفروع أخرى
          </span>
        )
      ) : null}
    </div>
  );
}

function BranchBreakdown({
  availability,
  currentBranchName,
  onCurrentBranchQtyClick,
  onBranchQtyClick,
}: {
  availability: CatalogLeafAvailability;
  currentBranchName: string;
  onCurrentBranchQtyClick?: () => void;
  onBranchQtyClick?: (branchId: string, branchName: string, quantity: number) => void;
}) {
  if (!availability.hasAnyStock) {
    return (
      <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
        لا يوجد مخزون في أي فرع من فروع الشركة.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-black/25 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted inline-flex items-center gap-1">
          <span aria-hidden>{em.branch}</span>
          {currentBranchName}
        </span>
        {onCurrentBranchQtyClick && availability.currentBranchQty > 0 ? (
          <button
            type="button"
            onClick={onCurrentBranchQtyClick}
            className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-200 hover:bg-emerald-500/25 transition-colors"
            title="عرض IMEI — جديد/مستعمل — السعر"
          >
            {availability.currentBranchQty} متاح
          </button>
        ) : (
          <span
            className={cn(
              "font-bold",
              availability.currentBranchQty > 0 ? "text-emerald-300" : "text-muted"
            )}
          >
            {availability.currentBranchQty > 0 ? `${availability.currentBranchQty} متاح` : "غير متاح"}
          </span>
        )}
      </div>
      {availability.currentBranchQty > 0 && onCurrentBranchQtyClick ? (
        <p className="text-[10px] text-muted">اضغط «{availability.currentBranchQty} متاح» لعرض IMEI والحالة والسعر</p>
      ) : null}
      {availability.otherBranches.length > 0 ? (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <p className="text-[11px] text-muted inline-flex items-center gap-1">
            <span aria-hidden>{em.link}</span>
            فروع أخرى — اضغط العدد لعرض التفاصيل
          </p>
          {availability.otherBranches.map((branch) => (
            <div key={branch.branchId} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-white/90 truncate">
                {branch.branchName}
                {branch.branchCode ? (
                  <span className="text-muted ms-1">({branch.branchCode})</span>
                ) : null}
              </span>
              {onBranchQtyClick ? (
                <button
                  type="button"
                  onClick={() => onBranchQtyClick(branch.branchId, branch.branchName, branch.quantity)}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-500/15 px-2 py-0.5 font-bold text-sky-100 shrink-0 hover:bg-sky-500/25 transition-colors"
                  title="عرض IMEI — جديد/مستعمل — السعر"
                >
                  <span aria-hidden>{em.view}</span>
                  {branch.quantity}
                </button>
              ) : (
                <span className="font-bold text-sky-200 shrink-0">{branch.quantity}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted pt-1 border-t border-border/40">
          لا يوجد مخزون في فروع أخرى.
        </p>
      )}
    </div>
  );
}

function SerialUnitsModal({
  open,
  onClose,
  loading,
  error,
  title,
  subtitle,
  units,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string;
  title: string;
  subtitle: string;
  units: CatalogAvailabilitySerialUnit[];
}) {
  const showBranchColumn = new Set(units.map((unit) => unit.branchId)).size > 1;
  const showVariantColumn = new Set(units.map((unit) => unit.variantLabel)).size > 1;

  return (
    <Modal open={open} onClose={onClose} title={title} titleHint={subtitle || undefined} size="lg">
      {loading ? (
        <div className="py-12 text-center text-muted text-sm">جاري تحميل تفاصيل الأجهزة...</div>
      ) : error ? (
        <div className="py-10 text-center text-red-300 text-sm">{error}</div>
      ) : units.length === 0 ? (
        <div className="py-10 text-center text-muted text-sm">لا توجد أجهزة متاحة</div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted inline-flex items-center gap-1">
            <span aria-hidden>{em.view}</span>
            {units.length} جهاز — اضغط على IMEI للنسخ
          </p>
          <div className="rounded-2xl border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-white/5 text-xs text-muted">
                    <th className="py-2.5 px-3 text-right font-semibold">IMEI</th>
                    {showVariantColumn ? (
                      <th className="py-2.5 px-3 text-right font-semibold">المواصفات</th>
                    ) : null}
                    <th className="py-2.5 px-3 text-right font-semibold">الحالة</th>
                    <th className="py-2.5 px-3 text-right font-semibold">السعر</th>
                    {showBranchColumn ? (
                      <th className="py-2.5 px-3 text-right font-semibold">الفرع</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.serialId} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 px-3 align-middle">
                        <button
                          type="button"
                          className="font-mono text-xs text-white/95 hover:text-primary text-right break-all"
                          title="نسخ IMEI"
                          onClick={() => {
                            if (unit.imeis[0]) void navigator.clipboard.writeText(unit.imeis[0]);
                          }}
                        >
                          {unit.imeiLabel}
                        </button>
                      </td>
                      {showVariantColumn ? (
                        <td className="py-2.5 px-3 align-middle text-xs text-white/85">
                          {unit.variantLabel}
                        </td>
                      ) : null}
                      <td className="py-2.5 px-3 align-middle">
                        <PhoneConditionBadge condition={unit.deviceCondition} />
                      </td>
                      <td className="py-2.5 px-3 align-middle font-bold text-emerald-200 tabular-nums whitespace-nowrap">
                        {formatCurrency(unit.retailPrice)} ج.م
                      </td>
                      {showBranchColumn ? (
                        <td className="py-2.5 px-3 align-middle text-xs text-white/85">
                          {unit.branchName}
                          {unit.branchCode ? (
                            <span className="text-muted ms-1">({unit.branchCode})</span>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function KindPicker({ onSelect }: { onSelect: (kind: CatalogKind) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        type="button"
        onClick={() => onSelect("phone")}
        className="group relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-600/25 via-indigo-600/15 to-transparent p-5 text-right transition-all hover:border-violet-300/50 hover:shadow-glow-sm"
      >
        <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl transition group-hover:bg-violet-300/25" />
        <div className="relative space-y-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/25 text-2xl ring-1 ring-violet-300/30">
            {em.device}
          </span>
          <div>
            <p className="text-base font-extrabold text-white">موبايلات</p>
            <p className="text-xs text-muted mt-1">تصفح منصات وماركات وموديلات من الإعدادات</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("accessory")}
        className="group relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-600/25 via-teal-600/15 to-transparent p-5 text-right transition-all hover:border-cyan-300/50 hover:shadow-glow-sm"
      >
        <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full bg-cyan-400/20 blur-2xl transition group-hover:bg-cyan-300/25" />
        <div className="relative space-y-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/25 text-2xl ring-1 ring-cyan-300/30">
            {em.product}
          </span>
          <div>
            <p className="text-base font-extrabold text-white">اكسسوارات</p>
            <p className="text-xs text-muted mt-1">تصنيفات وماركات وأسماء الأصناف من الإعدادات</p>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function CatalogAvailabilityModal({
  open,
  onClose,
  referenceBranchId,
  referenceHint,
}: CatalogAvailabilityModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<CatalogAvailabilityPayload | null>(null);
  const [kind, setKind] = useState<CatalogKind | null>(null);
  const [search, setSearch] = useState("");
  const [phoneEntryKey, setPhoneEntryKey] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [expandedLeafId, setExpandedLeafId] = useState<string | null>(null);
  const [serialModal, setSerialModal] = useState<{
    open: boolean;
    loading: boolean;
    error: string;
    title: string;
    subtitle: string;
    units: CatalogAvailabilitySerialUnit[];
  }>({
    open: false,
    loading: false,
    error: "",
    title: "",
    subtitle: "",
    units: [],
  });

  const closeSerialModal = useCallback(() => {
    setSerialModal((prev) => ({ ...prev, open: false, loading: false, error: "" }));
  }, []);

  const openSerialModal = useCallback(
    async (query: {
      productId?: string;
      phoneModelId?: string;
      branchId?: string;
      excludeBranchId?: string;
      title: string;
      subtitle: string;
    }) => {
      setSerialModal({
        open: true,
        loading: true,
        error: "",
        title: query.title,
        subtitle: query.subtitle,
        units: [],
      });

      const params = new URLSearchParams();
      if (query.productId) params.set("productId", query.productId);
      if (query.phoneModelId) params.set("phoneModelId", query.phoneModelId);
      if (query.branchId) params.set("branchId", query.branchId);
      if (query.excludeBranchId) params.set("excludeBranchId", query.excludeBranchId);
      params.set("title", query.title);
      params.set("subtitle", query.subtitle);

      const { ok, data: payload } = await apiJson<CatalogAvailabilitySerialsPayload & { message?: string }>(
        `/api/sales/catalog-availability/serials?${params.toString()}`
      );

      if (ok) {
        setSerialModal({
          open: true,
          loading: false,
          error: "",
          title: payload.title || query.title,
          subtitle: payload.subtitle || query.subtitle,
          units: payload.units,
        });
      } else {
        setSerialModal({
          open: true,
          loading: false,
          error: payload.message || "تعذر تحميل تفاصيل الأجهزة",
          title: query.title,
          subtitle: query.subtitle,
          units: [],
        });
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError("");
    const query = referenceBranchId ? `?branchId=${encodeURIComponent(referenceBranchId)}` : "";
    apiJson<CatalogAvailabilityPayload & { message?: string }>(
      `/api/sales/catalog-availability${query}`
    ).then(({ ok, data: payload }) => {
      if (ok) {
        setData(payload);
      } else {
        setError(payload.message || "تعذر تحميل البيانات");
      }
      setLoading(false);
    });
  }, [open, referenceBranchId]);

  const resetNavigation = () => {
    setKind(null);
    setSearch("");
    setPhoneEntryKey(null);
    setCategoryId(null);
    setBrandId(null);
    setExpandedLeafId(null);
    closeSerialModal();
  };

  const handleClose = () => {
    resetNavigation();
    onClose();
  };

  const phoneEntry = useMemo(
    () => data?.phoneCatalog.entries.find((entry) => entry.key === phoneEntryKey) ?? null,
    [data, phoneEntryKey]
  );

  const accessoryCategory = useMemo(
    () => data?.itemCatalog.categories.find((category) => category.id === categoryId) ?? null,
    [data, categoryId]
  );

  const accessoryBrand = useMemo(
    () => accessoryCategory?.brands.find((brand) => brand.id === brandId) ?? null,
    [accessoryCategory, brandId]
  );

  const filteredPhoneModels = useMemo(() => {
    if (!phoneEntry) return [];
    const q = search.trim().toLowerCase();
    if (!q) return phoneEntry.models;
    return phoneEntry.models.filter(
      (model) =>
        model.name.toLowerCase().includes(q) || phoneEntry.name.toLowerCase().includes(q)
    );
  }, [phoneEntry, search]);

  const filteredPhoneEntries = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const entries =
      !q
        ? data.phoneCatalog.entries
        : data.phoneCatalog.entries.filter((entry) => {
            if (entry.name.toLowerCase().includes(q)) return true;
            return entry.models.some((model) => model.name.toLowerCase().includes(q));
          });
    return sortPhoneCatalogEntries(entries);
  }, [data, search]);

  const flatPhoneResults = useMemo<PhoneLeaf[]>(() => {
    if (!data || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    const rows: PhoneLeaf[] = [];
    for (const entry of data.phoneCatalog.entries) {
      for (const model of entry.models) {
        if (
          model.name.toLowerCase().includes(q) ||
          entry.name.toLowerCase().includes(q) ||
          model.variants.some((variant) => variant.label.toLowerCase().includes(q))
        ) {
          rows.push({
            ...model,
            groupName: entry.name,
            groupKey: entry.key,
            groupLogoUrl: entry.logoUrl,
          });
        }
      }
    }
    return rows;
  }, [data, search]);

  const flatAccessoryResults = useMemo<AccessoryLeaf[]>(() => {
    if (!data || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    const rows: AccessoryLeaf[] = [];
    for (const category of data.itemCatalog.categories) {
      for (const brand of category.brands) {
        for (const name of brand.names) {
          if (
            name.name.toLowerCase().includes(q) ||
            brand.name.toLowerCase().includes(q) ||
            category.name.toLowerCase().includes(q)
          ) {
            rows.push({
              ...name,
              categoryName: category.name,
              categoryId: category.id,
              categoryLogoUrl: category.logoUrl,
              brandName: brand.name,
              brandId: brand.id,
              brandLogoUrl: brand.logoUrl,
            });
          }
        }
      }
    }
    return rows;
  }, [data, search]);

  const breadcrumb = useMemo(() => {
    const parts: Array<{ label: string; onClick?: () => void }> = [
      {
        label: kind === "phone" ? "موبايلات" : "اكسسوارات",
        onClick: () => {
          setPhoneEntryKey(null);
          setCategoryId(null);
          setBrandId(null);
          setExpandedLeafId(null);
        },
      },
    ];

    if (kind === "phone" && phoneEntry) {
      parts.push({
        label: phoneEntry.name,
        onClick: () => {
          setExpandedLeafId(null);
        },
      });
    }

    if (kind === "accessory") {
      if (accessoryCategory) {
        parts.push({
          label: accessoryCategory.name,
          onClick: () => {
            setBrandId(null);
            setExpandedLeafId(null);
          },
        });
      }
      if (accessoryBrand) {
        parts.push({ label: accessoryBrand.name });
      }
    }

    return parts;
  }, [kind, phoneEntry, accessoryCategory, accessoryBrand]);

  const renderPhoneModelCard = (
    leafId: string,
    model: PhoneCatalogAvailabilityModel,
    subtitle: string | null,
    logoUrl?: string | null
  ) => {
    const expanded = expandedLeafId === leafId;
    const currentBranch = data?.currentBranch;
    const currentBranchId = currentBranch?.id;

    const openModelSerials = (opts: {
      branchId?: string;
      excludeBranchId?: string;
      subtitle: string;
    }) => {
      void openSerialModal({
        phoneModelId: model.id,
        branchId: opts.branchId,
        excludeBranchId: opts.excludeBranchId,
        title: model.name,
        subtitle: opts.subtitle,
      });
    };

    const openVariantSerials = (
      variant: PhoneCatalogAvailabilityModel["variants"][number],
      opts: { branchId?: string; excludeBranchId?: string; subtitle: string }
    ) => {
      void openSerialModal({
        productId: variant.productId,
        branchId: opts.branchId,
        excludeBranchId: opts.excludeBranchId,
        title: `${model.name} — ${variant.label}`,
        subtitle: opts.subtitle,
      });
    };

    return (
      <div
        key={leafId}
        className={cn(
          "rounded-2xl border transition-all",
          expanded
            ? "border-primary/40 bg-primary/10 shadow-glow-sm"
            : "border-border/60 bg-black/20 hover:border-white/20"
        )}
      >
        <button
          type="button"
          onClick={() => setExpandedLeafId(expanded ? null : leafId)}
          className="w-full px-4 py-3 text-right"
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              {logoUrl !== undefined ? (
                <LogoDisplay url={logoUrl} name={model.name} size="sm" className="ring-1 ring-white/10 shrink-0" />
              ) : null}
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{model.name}</p>
                {subtitle ? <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p> : null}
                {model.variants.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {model.variants.map((variant) => (
                      <span
                        key={variant.productId}
                        className="text-[11px] rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-100 border border-emerald-400/25"
                      >
                        {variant.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <AvailabilityPills
              availability={model.availability}
              currentBranchName={currentBranch?.name || "الفرع الحالي"}
              onCurrentBranchClick={
                model.availability.currentBranchQty > 0 && currentBranchId
                  ? () =>
                      openModelSerials({
                        branchId: currentBranchId,
                        subtitle: currentBranch?.name || "الفرع الحالي",
                      })
                  : undefined
              }
              onOtherBranchesClick={
                model.availability.totalOtherQty > 0 && currentBranchId
                  ? () =>
                      openModelSerials({
                        excludeBranchId: currentBranchId,
                        subtitle: "فروع أخرى",
                      })
                  : undefined
              }
            />
          </div>
        </button>
        {expanded ? (
          <div className="px-4 pb-4">
            <BranchBreakdown
              availability={model.availability}
              currentBranchName={currentBranch?.name || "الفرع الحالي"}
              onCurrentBranchQtyClick={
                model.availability.currentBranchQty > 0 && currentBranchId
                  ? () =>
                      openModelSerials({
                        branchId: currentBranchId,
                        subtitle: currentBranch?.name || "الفرع الحالي",
                      })
                  : undefined
              }
              onBranchQtyClick={(branchId, branchName) =>
                openModelSerials({ branchId, subtitle: branchName })
              }
            />
            {model.variants.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                <p className="text-xs text-muted">الأجهزة المتاحة بالتفصيل</p>
                {model.variants.map((variant) => (
                  <div
                    key={variant.productId}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{variant.label}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {variant.color ? (
                            <span className="text-[10px] rounded-full px-2 py-0.5 bg-violet-500/20 text-violet-100">
                              🎨 {variant.color}
                            </span>
                          ) : null}
                          {variant.storage ? (
                            <span className="text-[10px] rounded-full px-2 py-0.5 bg-cyan-500/20 text-cyan-100">
                              💾 {variant.storage}
                            </span>
                          ) : null}
                          {variant.ram ? (
                            <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-500/20 text-amber-100">
                              ⚡ {variant.ram}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <AvailabilityPills
                        availability={variant.availability}
                        currentBranchName={currentBranch?.name || "الفرع الحالي"}
                        compact
                        onCurrentBranchClick={
                          variant.availability.currentBranchQty > 0 && currentBranchId
                            ? () =>
                                openVariantSerials(variant, {
                                  branchId: currentBranchId,
                                  subtitle: currentBranch?.name || "الفرع الحالي",
                                })
                            : undefined
                        }
                        onOtherBranchesClick={
                          variant.availability.totalOtherQty > 0 && currentBranchId
                            ? () =>
                                openVariantSerials(variant, {
                                  excludeBranchId: currentBranchId,
                                  subtitle: "فروع أخرى",
                                })
                            : undefined
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : model.availability.hasAnyStock ? (
              <p className="text-xs text-muted mt-3 pt-3 border-t border-white/10">
                المخزون مسجّل بدون تفاصيل لون أو مساحة
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderLeafCard = (
    id: string,
    title: string,
    subtitle: string | null,
    availability: CatalogLeafAvailability,
    logoUrl?: string | null
  ) => {
    const expanded = expandedLeafId === id;
    return (
      <div
        key={id}
        className={cn(
          "rounded-2xl border transition-all",
          expanded
            ? "border-primary/40 bg-primary/10 shadow-glow-sm"
            : "border-border/60 bg-black/20 hover:border-white/20"
        )}
      >
        <button
          type="button"
          onClick={() => setExpandedLeafId(expanded ? null : id)}
          className="w-full px-4 py-3 text-right"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl !== undefined ? (
                <LogoDisplay url={logoUrl} name={title} size="sm" className="ring-1 ring-white/10" />
              ) : null}
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{title}</p>
                {subtitle ? <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p> : null}
              </div>
            </div>
            <AvailabilityPills
              availability={availability}
              currentBranchName={data?.currentBranch.name || "الفرع الحالي"}
            />
          </div>
        </button>
        {expanded ? (
          <div className="px-4 pb-4">
            <BranchBreakdown
              availability={availability}
              currentBranchName={data?.currentBranch.name || "الفرع الحالي"}
            />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="استعلام توفر المنتجات"
        titleHint="عرض فقط — حسب الفروع"
        size="xl"
      >
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent px-4 py-3">
          <p className="text-sm text-amber-100/90 inline-flex items-center gap-2 flex-wrap">
            <span aria-hidden>{em.view}</span>
            <span>
              اعرف هل الصنف متاح في{" "}
              <strong className="text-white">{data?.currentBranch.name || "فرعك الحالي"}</strong> أو في
              فروع أخرى فقط — بدون إضافة للفاتورة.
            </span>
          </p>
          {referenceHint ? (
            <p className="text-xs text-amber-200/80 mt-2">{referenceHint}</p>
          ) : null}
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted">جاري تحميل التصنيفات والمخزون...</div>
        ) : error ? (
          <div className="py-10 text-center text-red-300">{error}</div>
        ) : !data ? null : kind === null ? (
          <KindPicker onSelect={setKind} />
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                <button
                  type="button"
                  onClick={resetNavigation}
                  className="rounded-lg px-2 py-1 hover:bg-white/10 text-white/80"
                >
                  البداية
                </button>
                {breadcrumb.map((part, index) => (
                  <span key={`${part.label}-${index}`} className="inline-flex items-center gap-1">
                    <span>/</span>
                    {part.onClick ? (
                      <button
                        type="button"
                        onClick={part.onClick}
                        className="rounded-lg px-2 py-1 hover:bg-white/10 text-white/90"
                      >
                        {part.label}
                      </button>
                    ) : (
                      <span className="text-white px-1">{part.label}</span>
                    )}
                  </span>
                ))}
              </div>
              <div className="relative flex-1 min-w-[220px]">
                <span className="absolute inset-y-0 start-3 flex items-center text-base pointer-events-none">
                  {em.search}
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={kind === "phone" ? "بحث في الموديلات..." : "بحث في الأصناف..."}
                  className="w-full rounded-xl border border-border bg-background-input py-2.5 ps-10 pe-3 text-sm text-white placeholder:text-muted focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            {search.trim() ? (
              <div className="space-y-2">
                <p className="text-xs text-muted inline-flex items-center gap-1">
                  <span aria-hidden>{em.search}</span>
                  نتائج البحث ({kind === "phone" ? flatPhoneResults.length : flatAccessoryResults.length})
                </p>
                {kind === "phone"
                  ? flatPhoneResults.map((model) =>
                      renderPhoneModelCard(
                        `search-phone-${model.id}`,
                        model,
                        model.groupName,
                        model.groupLogoUrl
                      )
                    )
                  : flatAccessoryResults.map((item) =>
                      renderLeafCard(
                        `search-item-${item.id}`,
                        item.name,
                        `${item.categoryName} · ${item.brandName}`,
                        item.availability,
                        item.brandLogoUrl || item.categoryLogoUrl
                      )
                    )}
                {(kind === "phone" ? flatPhoneResults : flatAccessoryResults).length === 0 ? (
                  <p className="text-center text-sm text-muted py-8">لا توجد نتائج مطابقة</p>
                ) : null}
              </div>
            ) : kind === "phone" ? (
              !phoneEntry ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredPhoneEntries.map((entry) => {
                    const inStockCount = entry.models.filter((m) => m.availability.hasAnyStock).length;
                    return (
                      <CatalogNavCard
                        key={entry.key}
                        name={entry.name}
                        logoUrl={entry.logoUrl}
                        badge={`${entry.models.length} موديل`}
                        subtitle={
                          inStockCount > 0
                            ? `${inStockCount} موديل متوفر`
                            : "لا يوجد مخزون حالياً"
                        }
                        accent="violet"
                        onClick={() => {
                          setPhoneEntryKey(entry.key);
                          setExpandedLeafId(null);
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <CatalogSectionBanner
                    name={phoneEntry.name}
                    logoUrl={phoneEntry.logoUrl}
                    subtitle={`${phoneEntry.models.length} موديل · ${phoneEntry.models.filter((m) => m.availability.hasAnyStock).length} متوفر`}
                  />
                  <div className="space-y-2">
                    {filteredPhoneModels.map((model) =>
                      renderPhoneModelCard(model.id, model, phoneEntry.name)
                    )}
                    {filteredPhoneModels.length === 0 ? (
                      <p className="text-center text-sm text-muted py-8">لا توجد موديلات في هذا التصنيف</p>
                    ) : null}
                  </div>
                </div>
              )
            ) : !categoryId ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.itemCatalog.categories.map((category) => {
                  const leafCount = category.brands.reduce((sum, brand) => sum + brand.names.length, 0);
                  const inStockCount = category.brands.reduce(
                    (sum, brand) => sum + brand.names.filter((name) => name.availability.hasAnyStock).length,
                    0
                  );
                  return (
                    <CatalogNavCard
                      key={category.id}
                      name={category.name}
                      logoUrl={category.logoUrl}
                      badge={`${category.brands.length} ماركة`}
                      subtitle={`${leafCount} صنف · ${inStockCount > 0 ? `${inStockCount} متوفر` : "لا مخزون"}`}
                      accent="cyan"
                      onClick={() => {
                        setCategoryId(category.id);
                        setBrandId(null);
                        setExpandedLeafId(null);
                      }}
                    />
                  );
                })}
              </div>
            ) : !brandId ? (
              <div className="space-y-3">
                <CatalogSectionBanner
                  name={accessoryCategory?.name || ""}
                  logoUrl={accessoryCategory?.logoUrl}
                  subtitle={`${accessoryCategory?.brands.length || 0} ماركة`}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {accessoryCategory?.brands.map((brand) => {
                  const inStockCount = brand.names.filter((name) => name.availability.hasAnyStock).length;
                    return (
                      <CatalogNavCard
                        key={brand.id}
                        name={brand.name}
                        logoUrl={brand.logoUrl}
                        badge={`${brand.names.length} صنف`}
                        subtitle={inStockCount > 0 ? `${inStockCount} متوفر` : "لا مخزون"}
                        accent="teal"
                        onClick={() => {
                          setBrandId(brand.id);
                          setExpandedLeafId(null);
                        }}
                      />
                    );
                })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <CatalogSectionBanner
                  name={accessoryBrand?.name || ""}
                  logoUrl={accessoryBrand?.logoUrl}
                  subtitle={`${accessoryCategory?.name} · ${accessoryBrand?.names.length || 0} صنف`}
                />
                <div className="space-y-2">
                  {accessoryBrand?.names.map((item) =>
                    renderLeafCard(
                      item.id,
                      item.name,
                      `${accessoryCategory?.name} · ${accessoryBrand.name}`,
                      item.availability
                    )
                  )}
                  {accessoryBrand?.names.length === 0 ? (
                    <p className="text-center text-sm text-muted py-8">لا توجد أصناف في هذه الماركة</p>
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </Modal>

      <SerialUnitsModal
        open={serialModal.open}
        onClose={closeSerialModal}
        loading={serialModal.loading}
        error={serialModal.error}
        title={serialModal.title}
        subtitle={serialModal.subtitle}
        units={serialModal.units}
      />
    </>
  );
}
