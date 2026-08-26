"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAccessoryBarcodeByItemName, fetchUniqueBarcode } from "@/lib/barcode-client";
import { accessoryCatalogLogoUrl } from "@/lib/product-image";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/utils";
import { LogoDisplay } from "@/components/ui/LogoUpload";

export interface ItemNameOption {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
}

export interface ItemCategoryOption {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  brands: {
    id: string;
    nameAr: string;
    logoUrl?: string | null;
    names: ItemNameOption[];
  }[];
}

export interface AccessoryPurchaseLine {
  itemCategoryId: string;
  itemBrandId: string;
  itemNameId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  retailPrice: number;
  minQuantity: number;
  barcode: string;
  deviceCondition: "new" | "used";
  itemNotes: string;
}

interface AccessoryPurchaseLineItemProps {
  index: number;
  item: AccessoryPurchaseLine;
  categories: ItemCategoryOption[];
  canRemove: boolean;
  onChange: (patch: Partial<AccessoryPurchaseLine>) => void;
  onRemove: () => void;
  barcodeNameHint?: string;
}

export function emptyAccessoryPurchaseLine(): AccessoryPurchaseLine {
  return {
    itemCategoryId: "",
    itemBrandId: "",
    itemNameId: "",
    productName: "",
    quantity: 1,
    unitPrice: 0,
    retailPrice: 0,
    minQuantity: 5,
    barcode: "",
    deviceCondition: "new",
    itemNotes: "",
  };
}

export default function AccessoryPurchaseLineItem({
  index,
  item,
  categories,
  canRemove,
  onChange,
  onRemove,
  barcodeNameHint,
}: AccessoryPurchaseLineItemProps) {
  const category = categories.find((c) => c.id === item.itemCategoryId);
  const brands = category?.brands || [];
  const brand = brands.find((b) => b.id === item.itemBrandId);
  const catalogNames = brand?.names || [];
  const useCatalogNames = Boolean(item.itemBrandId && catalogNames.length > 0);
  const displayName = item.productName.trim();
  const catalogName = catalogNames.find((n) => n.id === item.itemNameId);
  const previewName = catalogName?.nameAr || displayName || brand?.nameAr || category?.nameAr || "صنف";
  const imageUrl = accessoryCatalogLogoUrl(catalogName, brand, category);
  const showPreview = Boolean(
    imageUrl || item.itemNameId || displayName || item.itemBrandId || item.itemCategoryId
  );

  const [registeredBarcode, setRegisteredBarcode] = useState<string | null>(null);

  const usesRegisteredBarcode = Boolean(
    registeredBarcode && item.barcode.trim() === registeredBarcode
  );

  useEffect(() => {
    if (!item.itemNameId) {
      setRegisteredBarcode(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const existing = await fetchAccessoryBarcodeByItemName(
        item.itemNameId,
        item.deviceCondition
      );

      if (cancelled) return;

      if (existing) {
        setRegisteredBarcode(existing);
        onChange({ barcode: existing });
      } else {
        setRegisteredBarcode(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item.itemNameId, item.deviceCondition]);

  const handleGenerateBarcode = async () => {
    if (usesRegisteredBarcode) return;

    try {
      if (item.itemNameId) {
        const existing = await fetchAccessoryBarcodeByItemName(
          item.itemNameId,
          item.deviceCondition
        );

        if (existing) {
          setRegisteredBarcode(existing);
          onChange({ barcode: existing });
          return;
        }
      }

      const barcode = await fetchUniqueBarcode(barcodeNameHint || displayName);
      onChange({ barcode });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر توليد باركود");
    }
  };

  return (
    <div className="glass-card p-5 space-y-5 border border-accent-green/15">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">إكسسوار #{index + 1}</p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400/70 hover:text-red-400 text-xs"
          >
            حذف الصنف
          </button>
        )}
      </div>

      {showPreview && (
        <div className="flex items-center gap-3 rounded-xl border border-accent-green/20 bg-accent-green/5 p-3">
          <LogoDisplay url={imageUrl} name={previewName} size="product" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{previewName}</p>
            <p className="text-[11px] text-muted mt-0.5">
              {[category?.nameAr, brand?.nameAr].filter(Boolean).join(" · ") || "إكسسوار"}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.length > 0 && (
          <div>
            <label className="block text-xs text-muted mb-1.5">تصنيف الصنف</label>
            <select
              value={item.itemCategoryId}
              onChange={(e) =>
                onChange({
                  itemCategoryId: e.target.value,
                  itemBrandId: "",
                  itemNameId: "",
                  productName: "",
                  barcode: "",
                })
              }
              className="glass-input text-sm"
            >
              <option value="">— بدون تصنيف —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}

        {brands.length > 0 && (
          <div>
            <label className="block text-xs text-muted mb-1.5">العلامة التجارية</label>
            <select
              value={item.itemBrandId}
              onChange={(e) =>
                onChange({
                  itemBrandId: e.target.value,
                  itemNameId: "",
                  productName: "",
                  barcode: "",
                })
              }
              className="glass-input text-sm"
              disabled={!item.itemCategoryId}
            >
              <option value="">— اختر —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={categories.length > 0 && brands.length > 0 ? "" : "sm:col-span-2"}>
          <label className="block text-xs text-muted mb-1.5">اسم الصنف *</label>
          {useCatalogNames ? (
            <select
              value={item.itemNameId}
              onChange={(e) => {
                const id = e.target.value;
                const picked = catalogNames.find((n) => n.id === id);
                onChange({
                  itemNameId: id,
                  productName: picked?.nameAr || "",
                  barcode: "",
                });
              }}
              className="glass-input text-sm"
            >
              <option value="">— اختر من القائمة —</option>
              {catalogNames.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nameAr}
                </option>
              ))}
            </select>
          ) : item.itemBrandId && catalogNames.length === 0 ? (
            <div className="rounded-xl border border-accent-orange/30 bg-accent-orange/5 px-3 py-2.5 text-xs text-accent-orange">
              لا توجد أسماء لهذه العلامة —{" "}
              <Link href="/dashboard/settings/item-catalog" className="underline hover:text-white">
                أضفها من الإعدادات
              </Link>
            </div>
          ) : (
            <input
              value={item.productName}
              onChange={(e) => onChange({ productName: e.target.value, itemNameId: "" })}
              placeholder="مثال: سماعة AirPods Pro"
              className="glass-input text-sm"
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">الباركود</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={item.barcode}
            onChange={(e) => onChange({ barcode: e.target.value.trim() })}
            placeholder={
              usesRegisteredBarcode
                ? "باركود محفوظ لهذا الصنف"
                : "امسح من العلبة أو اكتب يدوياً"
            }
            readOnly={usesRegisteredBarcode}
            title={
              usesRegisteredBarcode
                ? "الباركود ثابت لهذا الصنف المسجّل — لا يمكن تعديله"
                : undefined
            }
            className={`glass-input text-sm flex-1 ${
              usesRegisteredBarcode ? "opacity-70 cursor-not-allowed bg-white/5" : ""
            }`}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void handleGenerateBarcode()}
            disabled={usesRegisteredBarcode}
            title={
              usesRegisteredBarcode
                ? "الباركود محفوظ مسبقاً لهذا الصنف — لا حاجة لتوليد باركود جديد"
                : undefined
            }
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold border whitespace-nowrap ${
              usesRegisteredBarcode
                ? "border-white/10 text-muted cursor-not-allowed opacity-50"
                : "border-primary/40 text-primary-light hover:bg-primary/10"
            }`}
          >
            توليد باركود تلقائي
          </button>
        </div>
        {usesRegisteredBarcode && (
          <p className="text-[11px] text-accent-green/90 mt-1.5">
            ✓ هذا الصنف مسجّل مسبقاً — الباركود محفوظ ولا يمكن تعديله
          </p>
        )}
      </div>

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
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value)) })}
            className="glass-input text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">حد التنبيه</label>
          <input
            type="number"
            min={0}
            value={item.minQuantity}
            onChange={(e) => onChange({ minQuantity: Math.max(0, Number(e.target.value)) })}
            className="glass-input text-sm"
            title="تنبيه عند انخفاض المخزون عن هذا الرقم"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1.5">الحالة</label>
          <select
            value={item.deviceCondition}
            onChange={(e) => onChange({ deviceCondition: e.target.value as "new" | "used" })}
            className="glass-input text-sm"
          >
            <option value="new">جديد</option>
            <option value="used">مستعمل</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1.5">إجمالي الشراء</label>
          <div className="glass-input text-sm flex items-center font-bold text-white">
            {formatCurrency(item.quantity * item.unitPrice)} ج.م
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1.5">ملاحظات على هذا الصنف</label>
        <textarea
          value={item.itemNotes}
          onChange={(e) => onChange({ itemNotes: e.target.value })}
          placeholder="أي ملاحظات خاصة بهذا الصنف..."
          className="glass-input text-sm min-h-[72px]"
        />
      </div>
    </div>
  );
}
