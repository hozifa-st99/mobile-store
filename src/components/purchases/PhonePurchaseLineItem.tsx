"use client";

import { useEffect, useMemo, useState } from "react";

import PhoneModelSpecSelect from "@/components/phones/PhoneModelSpecSelect";
import DualSimImeiSuggestion from "@/components/purchases/DualSimImeiSuggestion";
import { LogoDisplay } from "@/components/ui/LogoUpload";
import { apiJson } from "@/lib/api-client";
import { fetchUniqueBarcode } from "@/lib/barcode-client";
import type { ImeiCyclePreview } from "@/lib/imei-cycle-preview-types";
import { phoneCatalogLogoUrl } from "@/lib/product-image";
import { isValidImeiFormat } from "@/lib/product-serial-imeis";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/utils";
import { isIphonePlatform } from "@/lib/iphone-platform";
import { getClientSpecRequirements } from "@/lib/phone-model-requirements";
import { parseTaxStatus, TAX_STATUS_OPTIONS, type TaxStatus } from "@/lib/phone-device-display";

export interface PhonePlatformOption {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  requiresBrand: boolean;
  requireColors?: boolean;
  requireStorage?: boolean;
  requireRam?: boolean;
  brands: {
    id: string;
    nameAr: string;
    logoUrl?: string | null;
    requireColors?: boolean;
    requireStorage?: boolean;
    requireRam?: boolean;
    models: PhoneModelOption[];
  }[];
  models: PhoneModelOption[];
}

export interface PhoneModelOption {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  colors?: unknown;
  storageOptions?: unknown;
  ramOptions?: unknown;
}

export interface PhonePurchaseLine {
  platformId: string;
  brandId: string;
  modelId: string;
  color: string;
  storage: string;
  ram: string;
  imeis: string[];
  unitPrice: number;
  retailPrice: number;
  barcode: string;
  warrantyMonths: number;
  taxStatus: TaxStatus;
  deviceCondition: "new" | "used";
  boxCondition: "" | "excellent" | "medium" | "missing";
  batteryPercent: number | "";
  itemNotes: string;
}

interface PhonePurchaseLineItemProps {
  index: number;
  item: PhonePurchaseLine;
  platforms: PhonePlatformOption[];
  canRemove: boolean;
  onChange: (patch: Partial<PhonePurchaseLine>) => void;
  onRemove: () => void;
  barcodeNameHint?: string;
}

function findModel(platforms: PhonePlatformOption[], item: PhonePurchaseLine) {
  const platform = platforms.find((p) => p.id === item.platformId);
  if (!platform) return null;
  const models = platform.requiresBrand
    ? platform.brands.find((b) => b.id === item.brandId)?.models || []
    : platform.models;
  return models.find((m) => m.id === item.modelId) || null;
}

export function emptyPhonePurchaseLine(): PhonePurchaseLine {
  return {
    platformId: "",
    brandId: "",
    modelId: "",
    color: "",
    storage: "",
    ram: "",
    imeis: [""],
    unitPrice: 0,
    retailPrice: 0,
    barcode: "",
    warrantyMonths: 12,
    taxStatus: "zero",
    deviceCondition: "new",
    boxCondition: "",
    batteryPercent: "",
    itemNotes: "",
  };
}

const resetImeiAndBarcode = {
  imeis: [""],
  barcode: "",
} satisfies Partial<PhonePurchaseLine>;

export default function PhonePurchaseLineItem({
  index,
  item,
  platforms,
  canRemove,
  onChange,
  onRemove,
  barcodeNameHint,
}: PhonePurchaseLineItemProps) {
  const platform = platforms.find((p) => p.id === item.platformId);
  const models = platform?.requiresBrand
    ? platform.brands.find((b) => b.id === item.brandId)?.models || []
    : platform?.models || [];
  const selectedModel = findModel(platforms, item);
  const brand = platform?.brands.find((b) => b.id === item.brandId);
  const imageUrl = selectedModel
    ? phoneCatalogLogoUrl({
        logoUrl: selectedModel.logoUrl,
        brand,
        platform: platform ?? undefined,
      })
    : null;
  const isUsed = item.deviceCondition === "used";
  const isIphone = isIphonePlatform(platform);
  const batteryRequired = isUsed && isIphone;
  const specRequirements = getClientSpecRequirements(platforms, item);
  const showSpecFields =
    specRequirements.requireColors ||
    specRequirements.requireStorage ||
    specRequirements.requireRam;

  const filledImeis = useMemo(
    () => item.imeis.map((value) => value.trim()).filter(Boolean),
    [item.imeis]
  );
  const [cyclePreview, setCyclePreview] = useState<ImeiCyclePreview | null>(null);
  const [cycleLoading, setCycleLoading] = useState(false);

  useEffect(() => {
    if (filledImeis.length === 0 || filledImeis.some((imei) => !isValidImeiFormat(imei))) {
      setCyclePreview(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setCycleLoading(true);
      void apiJson<{ preview: ImeiCyclePreview }>(
        `/api/devices/imei-cycle-preview?imei=${encodeURIComponent(filledImeis.join(","))}`
      )
        .then(({ ok, data }) => {
          if (cancelled) return;
          setCyclePreview(ok && data?.preview ? data.preview : null);
          setCycleLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setCyclePreview(null);
          setCycleLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filledImeis.join(",")]);

  const cycleHintClass = cyclePreview?.blocked
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : cyclePreview?.isReEntry
      ? "border-accent-orange/30 bg-accent-orange/10 text-accent-orange"
      : "border-primary/30 bg-primary/10 text-primary-light";

  const handleGenerateBarcode = async () => {
    try {
      const model = findModel(platforms, item);
      const barcode = await fetchUniqueBarcode(barcodeNameHint || model?.nameAr);
      onChange({ barcode });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر توليد باركود");
    }
  };

  return (
    <div className="glass-card p-5 space-y-5 border border-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">موبايل #{index + 1}</p>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-red-400/70 hover:text-red-400 text-xs">
            حذف الصنف
          </button>
        )}
      </div>

      {selectedModel && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <LogoDisplay url={imageUrl} name={selectedModel.nameAr} size="product" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{selectedModel.nameAr}</p>
            <p className="text-[11px] text-muted mt-0.5">
              {[platform?.requiresBrand ? brand?.nameAr : platform?.nameAr]
                .filter(Boolean)
                .join(" · ") || "موبايل"}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1.5">
            {platform?.requiresBrand ? "نوع الجهاز" : "شركة الموبايل"}
          </label>
          <select
            value={item.platformId}
            onChange={(e) =>
              onChange({
                platformId: e.target.value,
                brandId: "",
                modelId: "",
                color: "",
                storage: "",
                ram: "",
                ...resetImeiAndBarcode,
              })
            }
            className="glass-input text-sm"
          >
            <option value="">— اختر —</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameAr}
              </option>
            ))}
          </select>
        </div>

        {platform?.requiresBrand && (
          <div>
            <label className="block text-xs text-muted mb-1.5">شركة الموبايل *</label>
            <select
              value={item.brandId}
              onChange={(e) =>
                onChange({
                  brandId: e.target.value,
                  modelId: "",
                  color: "",
                  storage: "",
                  ram: "",
                  ...resetImeiAndBarcode,
                })
              }
              className="glass-input text-sm"
              disabled={!item.platformId}
            >
              <option value="">— اختر —</option>
              {platform.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-muted mb-1.5">الموديل *</label>
          <select
            value={item.modelId}
            onChange={(e) =>
              onChange({
                modelId: e.target.value,
                color: "",
                storage: "",
                ram: "",
                ...resetImeiAndBarcode,
              })
            }
            className="glass-input text-sm"
            disabled={!item.platformId || (platform?.requiresBrand && !item.brandId)}
          >
            <option value="">— اختر —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedModel && showSpecFields && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-primary-light mb-3">المواصفات (من الإعدادات)</p>
          <PhoneModelSpecSelect
            model={selectedModel}
            color={item.color}
            storage={item.storage}
            ram={item.ram}
            requirements={specRequirements}
            onChange={(next) => onChange(next)}
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-xs text-muted">أرقام IMEI *</label>
          <button
            type="button"
            onClick={() => onChange({ imeis: [...item.imeis, ""] })}
            className="text-xs text-primary-light flex items-center gap-1"
          >
            ➕ إضافة IMEI
          </button>
        </div>
        <div className="space-y-2">
          {item.imeis.map((imei, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={imei}
                maxLength={15}
                inputMode="numeric"
                onChange={(e) => {
                  const updated = [...item.imeis];
                  updated[i] = e.target.value.replace(/\D/g, "").slice(0, 15);
                  onChange({ imeis: updated });
                }}
                className="glass-input text-sm flex-1"
                placeholder="352099001761481"
                autoComplete="off"
              />
              {item.imeis.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ imeis: item.imeis.filter((_, j) => j !== i) })}
                  className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted hover:text-red-400 shrink-0"
                >
                  ❌
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-dark mt-1.5">
          جهاز واحد — يمكن إدخال أكثر من IMEI للموبايل بخطين (Dual SIM)
        </p>
        {cycleLoading ? (
          <p className="text-[11px] text-muted mt-2">جاري التحقق من دورة الجهاز...</p>
        ) : cyclePreview?.blocked && cyclePreview.message ? (
          <p className="text-[11px] mt-2 rounded-xl border px-3 py-2 border-red-500/30 bg-red-500/10 text-red-300">
            {cyclePreview.message}
          </p>
        ) : cyclePreview?.isReEntry && cyclePreview.message ? (
          <p className={`text-[11px] mt-2 rounded-xl border px-3 py-2 ${cycleHintClass}`}>
            {cyclePreview.message}
          </p>
        ) : cyclePreview && !cyclePreview.isReEntry ? (
          <p className={`text-[11px] mt-2 rounded-xl border px-3 py-2 ${cycleHintClass}`}>
            أول دخول للمخزون — الدورة 1
          </p>
        ) : null}
        <DualSimImeiSuggestion
          cyclePreview={cyclePreview}
          imeis={item.imeis}
          onApply={(nextImeis) => onChange({ imeis: nextImeis })}
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">الباركود</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={item.barcode}
            onChange={(e) => onChange({ barcode: e.target.value.trim() })}
            placeholder="امسح من العلبة أو اكتب يدوياً"
            className="glass-input text-sm flex-1"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void handleGenerateBarcode()}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-primary/40 text-primary-light hover:bg-primary/10 whitespace-nowrap"
          >
            توليد باركود تلقائي
          </button>
        </div>
        <p className="text-[11px] text-muted-dark mt-1.5">
          يمكنك مسح الباركود بالسكانر أو توليد رقم فريد للمنتج
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1.5">الضمان (شهر)</label>
          <input
            type="number"
            min={0}
            value={item.warrantyMonths}
            onChange={(e) => onChange({ warrantyMonths: Number(e.target.value) })}
            className="glass-input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">الضريبة</label>
          <select
            value={item.taxStatus}
            onChange={(e) => onChange({ taxStatus: parseTaxStatus(e.target.value) })}
            className="glass-input text-sm"
          >
            {TAX_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">الحالة</label>
          <select
            value={item.deviceCondition}
            onChange={(e) => {
              const deviceCondition = e.target.value as "new" | "used";
              onChange({
                deviceCondition,
                boxCondition: deviceCondition === "new" ? "" : item.boxCondition,
                batteryPercent: deviceCondition === "new" ? "" : item.batteryPercent,
              });
            }}
            className="glass-input text-sm"
          >
            <option value="new">جديد</option>
            <option value="used">مستعمل</option>
          </select>
        </div>
      </div>

      {isUsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-accent-orange/25 bg-accent-orange/5 p-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">حالة الكارتونة *</label>
            <select
              value={item.boxCondition}
              onChange={(e) =>
                onChange({ boxCondition: e.target.value as PhonePurchaseLine["boxCondition"] })
              }
              className="glass-input text-sm"
            >
              <option value="">— اختر —</option>
              <option value="excellent">موجودة بحالة ممتازة</option>
              <option value="medium">موجودة بحالة متوسطة</option>
              <option value="missing">غير موجودة</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">
              نسبة البطارية % {batteryRequired ? "*" : "(اختياري)"}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              required={batteryRequired}
              value={item.batteryPercent}
              onChange={(e) =>
                onChange({
                  batteryPercent: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              placeholder={batteryRequired ? "مطلوب لـ iPhone" : "مثال: 87"}
              className="glass-input text-sm"
            />
            {batteryRequired && (
              <p className="text-[11px] text-accent-orange mt-1">إلزامي للمستعمل — iPhone</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1.5">سعر الشراء *</label>
          <input
            type="number"
            min={0}
            value={item.unitPrice || ""}
            onChange={(e) => onChange({ unitPrice: Number(e.target.value) })}
            className="glass-input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">سعر البيع *</label>
          <input
            type="number"
            min={0}
            value={item.retailPrice || ""}
            onChange={(e) => onChange({ retailPrice: Number(e.target.value) })}
            onBlur={() => {
              if (
                item.unitPrice > 0 &&
                item.retailPrice > 0 &&
                item.retailPrice < item.unitPrice
              ) {
                toast.error("سعر البيع لا يمكن أن يكون أقل من سعر الشراء");
                onChange({ retailPrice: 0 });
              } else if (
                item.unitPrice > 0 &&
                item.retailPrice > 0 &&
                item.retailPrice === item.unitPrice
              ) {
                toast.warning("سعر البيع يساوي سعر الشراء — لن يتحقق ربح من هذا البند");
              }
            }}
            className="glass-input text-sm"
          />
          {item.unitPrice > 0 && (
            <p className="text-[11px] text-muted-dark mt-1">الحد الأدنى: {item.unitPrice} ج.م</p>
          )}
          {item.unitPrice > 0 &&
            item.retailPrice > 0 &&
            item.retailPrice === item.unitPrice && (
              <p className="text-[11px] text-amber-500 mt-1">
                ⚠️ سعر البيع يساوي سعر الشراء — لا يوجد ربح
              </p>
            )}
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">الكمية</label>
          <div className="glass-input text-sm flex items-center text-muted" title="الموبايل دائماً جهاز واحد">
            1
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">إجمالي الشراء</label>
          <div className="glass-input text-sm flex items-center font-bold text-white">
            {formatCurrency(item.unitPrice)} ج.م
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">ملاحظات على هذا الصنف</label>
        <textarea
          value={item.itemNotes}
          onChange={(e) => onChange({ itemNotes: e.target.value })}
          placeholder="أي ملاحظات خاصة بهذا الموبايل..."
          className="glass-input text-sm min-h-[72px]"
        />
      </div>
    </div>
  );
}
