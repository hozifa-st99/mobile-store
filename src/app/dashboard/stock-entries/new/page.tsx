"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import AccessoryPurchaseLineItem, {
  emptyAccessoryPurchaseLine,
  type ItemCategoryOption,
} from "@/components/purchases/AccessoryPurchaseLineItem";
import PhonePurchaseLineItem, {
  emptyPhonePurchaseLine,
  type PhonePlatformOption,
  type PhonePurchaseLine,
} from "@/components/purchases/PhonePurchaseLineItem";
import PurchaseInvoiceLinesTable from "@/components/purchases/PurchaseInvoiceLinesTable";
import {
  newLineId,
  type ConfirmedPurchaseLine,
  type PurchaseLineItem,
} from "@/components/purchases/purchase-line-types";
import {
  accessoryDisplayName,
  buildInvoiceLineRow,
  lineSubtotal,
  phoneDisplayName,
} from "@/lib/purchase-line-display";
import { getModelOptionLists } from "@/lib/phone-model-options";
import {
  getClientSpecRequirements,
  phoneSpecValidationMessage,
  validatePhoneLineSpecs,
} from "@/lib/phone-model-requirements";
import { isIphonePlatform } from "@/lib/iphone-platform";
import { isValidImeiFormat } from "@/lib/product-serial-imeis";
import { apiJson } from "@/lib/api-client";
import { fetchAccessoryBarcodeByItemName, fetchUniqueBarcode } from "@/lib/barcode-client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";

function findModel(platforms: PhonePlatformOption[], item: PhonePurchaseLine) {
  const platform = platforms.find((p) => p.id === item.platformId);
  if (!platform) return null;
  const models = platform.requiresBrand
    ? platform.brands.find((b) => b.id === item.brandId)?.models || []
    : platform.models;
  return models.find((m) => m.id === item.modelId) || null;
}

function validateSingleLine(
  line: PurchaseLineItem,
  platforms: PhonePlatformOption[],
  categories: ItemCategoryOption[],
  excludeImeis: string[] = []
): string | null {
  if (line.lineType === "phone") {
    const item = line.data;
    if (!item.modelId) return "اختر موديل الموبايل";
    const platform = platforms.find((p) => p.id === item.platformId);
    if (platform?.requiresBrand && !item.brandId) return "اختر شركة الموبايل";
    const model = findModel(platforms, item);
    if (!model) return "موديل غير صالح";
    const specs = getModelOptionLists(model);
    const requirements = getClientSpecRequirements(platforms, item);
    const specError = validatePhoneLineSpecs(specs, requirements, item);
    if (specError) return phoneSpecValidationMessage(specError, model.nameAr);
    if (item.unitPrice <= 0) return `أدخل سعر الشراء — ${model.nameAr}`;
    if (item.retailPrice <= 0) return `أدخل سعر البيع — ${model.nameAr}`;
    if (item.retailPrice < item.unitPrice) return `سعر البيع أقل من سعر الشراء — ${model.nameAr}`;

    const imeis = item.imeis.map((i) => i.trim()).filter(Boolean);
    if (imeis.length === 0) return `أدخل IMEI واحد على الأقل — ${model.nameAr}`;
    for (const imei of imeis) {
      if (excludeImeis.includes(imei)) return `IMEI مكرر: ${imei}`;
      if (!isValidImeiFormat(imei)) return `IMEI غير صالح (15 رقم بالضبط): ${imei}`;
    }

    if (item.deviceCondition === "used") {
      if (!item.boxCondition) return `اختر حالة الكارتونة — ${model.nameAr}`;
      if (isIphonePlatform(platform)) {
        if (item.batteryPercent === "" || item.batteryPercent < 0 || item.batteryPercent > 100) {
          return `أدخل نسبة البطارية — iPhone مستعمل (${model.nameAr})`;
        }
      }
    }
    return null;
  }

  const item = line.data;
  const category = categories.find((c) => c.id === item.itemCategoryId);
  const brand = category?.brands.find((b) => b.id === item.itemBrandId);
  const catalogName = brand?.names.find((n) => n.id === item.itemNameId);
  const lineName = catalogName?.nameAr || item.productName.trim();

  if (!lineName) return "أدخل اسم الصنف";
  if (category && category.brands.length > 0 && !item.itemBrandId) {
    return `اختر العلامة التجارية — ${lineName}`;
  }
  if (brand && brand.names.length > 0 && !item.itemNameId) {
    return `اختر اسم الصنف من القائمة — ${brand.nameAr}`;
  }
  if (item.unitPrice <= 0) return `أدخل سعر الشراء — ${lineName}`;
  if (item.retailPrice <= 0) return `أدخل سعر البيع — ${lineName}`;
  if (item.retailPrice < item.unitPrice) return `سعر البيع أقل من سعر الشراء — ${lineName}`;
  if (item.quantity < 1) return `الكمية غير صالحة — ${lineName}`;
  return null;
}

function collectImeis(lines: ConfirmedPurchaseLine[]): string[] {
  return lines.flatMap((line) =>
    line.lineType === "phone" ? line.data.imeis.map((i) => i.trim()).filter(Boolean) : []
  );
}

export default function NewStockEntryPage() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<PhonePlatformOption[]>([]);
  const [categories, setCategories] = useState<ItemCategoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingDraft, setConfirmingDraft] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    documentNumber: "",
    notes: "",
  });

  const loadNextDocumentNumber = async () => {
    const { ok, data } = await apiJson<{ documentNumber?: string; message?: string }>(
      "/api/stock-entries/next-document-number"
    );
    if (ok && data.documentNumber) {
      setForm((prev) => ({ ...prev, documentNumber: data.documentNumber! }));
      return;
    }
    toast.error(data.message || "تعذر توليد رقم المستند — حدّث الصفحة");
  };

  const [confirmedItems, setConfirmedItems] = useState<ConfirmedPurchaseLine[]>([]);
  const [draft, setDraft] = useState<PurchaseLineItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/phone-platforms", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/settings/item-categories", { credentials: "include" }).then((r) => r.json()),
    ]).then(([plat, cat]) => {
      setPlatforms(plat.platforms || []);
      setCategories(cat.categories || []);
    });
    void loadNextDocumentNumber();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const subtotal = confirmedItems.reduce((s, line) => s + lineSubtotal(line), 0);

  const tableRows = useMemo(
    () => confirmedItems.map((line) => buildInvoiceLineRow(line, platforms, categories)),
    [confirmedItems, platforms, categories]
  );

  const startDraft = (type: "phone" | "accessory") => {
    if (draft) {
      toast.error("أكمل أو ألغِ الصنف الحالي أولاً");
      return;
    }
    setDraft(
      type === "phone"
        ? { lineType: "phone", data: emptyPhonePurchaseLine() }
        : { lineType: "accessory", data: emptyAccessoryPurchaseLine() }
    );
    setEditingId(null);
    setShowAddMenu(false);
  };

  const cancelDraft = () => {
    setDraft(null);
    setEditingId(null);
  };

  async function ensureLineBarcode(line: PurchaseLineItem): Promise<PurchaseLineItem> {
    if (line.lineType === "phone") {
      if (line.data.barcode.trim()) return line;
      const barcode = await fetchUniqueBarcode(phoneDisplayName(line.data, platforms));
      return { lineType: "phone", data: { ...line.data, barcode } };
    }
    if (line.data.barcode.trim()) return line;
    if (line.data.itemNameId) {
      const existing = await fetchAccessoryBarcodeByItemName(
        line.data.itemNameId,
        line.data.deviceCondition
      );
      if (existing) {
        return { lineType: "accessory", data: { ...line.data, barcode: existing } };
      }
    }
    const barcode = await fetchUniqueBarcode(accessoryDisplayName(line.data, categories));
    return { lineType: "accessory", data: { ...line.data, barcode } };
  }

  const confirmDraft = async () => {
    if (!draft || confirmingDraft) return;

    setConfirmingDraft(true);
    try {
      const lineWithBarcode = await ensureLineBarcode(draft);
      setDraft(lineWithBarcode);

      const otherImeis = collectImeis(
        editingId ? confirmedItems.filter((l) => l.id !== editingId) : confirmedItems
      );

      const validationError = validateSingleLine(
        lineWithBarcode,
        platforms,
        categories,
        otherImeis
      );
      if (validationError) {
        toast.error(validationError);
        return;
      }

      const purchasePrice = lineWithBarcode.data.unitPrice;
      const retailPrice = lineWithBarcode.data.retailPrice;
      if (purchasePrice > 0 && retailPrice > 0 && retailPrice === purchasePrice) {
        toast.warning("سعر البيع يساوي سعر الشراء — لن يتحقق ربح من هذا البند");
      }

      if (editingId) {
        setConfirmedItems((prev) =>
          prev.map((line) =>
            line.id === editingId ? { ...lineWithBarcode, id: editingId } : line
          )
        );
      } else {
        setConfirmedItems((prev) => [...prev, { ...lineWithBarcode, id: newLineId() }]);
      }

      setDraft(null);
      setEditingId(null);
      toast.success(editingId ? "تم تحديث الصنف" : "تمت إضافة الصنف للمستند");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر توليد الباركود");
    } finally {
      setConfirmingDraft(false);
    }
  };

  const editLine = (id: string) => {
    if (draft) {
      toast.error("أكمل أو ألغِ الصنف الحالي أولاً");
      return;
    }
    const line = confirmedItems.find((l) => l.id === id);
    if (!line) return;
    setDraft({ lineType: line.lineType, data: { ...line.data } });
    setEditingId(id);
  };

  const removeLine = (id: string) => {
    setConfirmedItems((prev) => prev.filter((l) => l.id !== id));
    if (editingId === id) cancelDraft();
  };

  const updatePhoneDraft = (patch: Partial<PhonePurchaseLine>) => {
    if (!draft || draft.lineType !== "phone") return;
    setDraft({ lineType: "phone", data: { ...draft.data, ...patch } });
  };

  const updateAccessoryDraft = (
    patch: Partial<ReturnType<typeof emptyAccessoryPurchaseLine>>
  ) => {
    if (!draft || draft.lineType !== "accessory") return;
    setDraft({ lineType: "accessory", data: { ...draft.data, ...patch } });
  };

  const draftBarcodeHint =
    draft?.lineType === "phone"
      ? phoneDisplayName(draft.data, platforms)
      : draft?.lineType === "accessory"
        ? accessoryDisplayName(draft.data, categories)
        : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.documentNumber.trim()) {
      toast.error("رقم المستند مطلوب");
      return;
    }
    if (draft) {
      toast.error("أضف الصنف الحالي للجدول أو ألغِه قبل الحفظ");
      return;
    }
    if (confirmedItems.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل");
      return;
    }

    setLoading(true);

    try {
      const payloadItems = confirmedItems.map((line) => {
        if (line.lineType === "phone") {
          const item = line.data;
          const imeis = item.imeis.map((i) => i.trim()).filter(Boolean);
          return {
            lineType: "phone",
            phoneModelId: item.modelId,
            color: item.color,
            storage: item.storage,
            ram: item.ram,
            quantity: 1,
            imeis,
            unitPrice: item.unitPrice,
            retailPrice: item.retailPrice,
            barcode: item.barcode.trim() || undefined,
            warrantyMonths: item.warrantyMonths,
            taxStatus: item.taxStatus,
            deviceCondition: item.deviceCondition,
            boxCondition: item.deviceCondition === "used" ? item.boxCondition : null,
            batteryPercent:
              item.deviceCondition === "used" && item.batteryPercent !== ""
                ? item.batteryPercent
                : null,
            itemNotes: item.itemNotes.trim() || null,
          };
        }

        const item = line.data;
        return {
          lineType: "accessory",
          itemCategoryId: item.itemCategoryId || null,
          itemBrandId: item.itemBrandId || null,
          itemNameId: item.itemNameId || null,
          productName: item.productName.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          retailPrice: item.retailPrice,
          minQuantity: item.minQuantity,
          barcode: item.barcode.trim() || undefined,
          deviceCondition: item.deviceCondition,
          itemNotes: item.itemNotes.trim() || null,
        };
      });

      await runPendingOperation(async () => {
        const { ok, data } = await apiJson<{ entry?: { id: string }; message?: string }>(
          "/api/stock-entries",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentNumber: form.documentNumber,
              notes: form.notes || null,
              items: payloadItems,
            }),
          }
        );

        if (ok && data.entry?.id) {
          toast.success("تم حفظ مستند إدخال الرصيد");
          router.push(`/dashboard/stock-entries/${data.entry.id}`);
          return;
        }

        toast.error(data.message || "حدث خطأ");
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <span className="text-lg">➡️</span> رجوع للمستندات
        </Link>
      </div>

      <PageHeader
        title="إدخال بضاعة — رصيد افتتاحي / موجود مسبقاً"
        subtitle="مستند لإضافة مخزون موجود مسبقاً — ليس فاتورة شراء ولا يؤثر على حسابات الموردين"
      />

      {platforms.length === 0 && (
        <div className="glass-card p-4 mb-5 border-accent-orange/30 bg-accent-orange/5">
          <p className="text-sm text-accent-orange">
            ⚠️ قائمة الموبايلات فارغة —{" "}
            <Link href="/dashboard/settings/phone-catalog" className="underline font-semibold">
              أضف الموديلات من الإعدادات
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1.5">رقم المستند (معرّف ثابت)</label>
              <div className="glass-input flex items-center justify-between text-sm font-bold text-accent-green bg-white/[0.03] cursor-not-allowed select-all">
                <span>{form.documentNumber || "جاري التوليد..."}</span>
                <span className="text-[10px] text-muted font-normal">🔒</span>
              </div>
              <p className="text-[11px] text-muted-dark mt-1">
                يُولَّد تلقائياً ولا يتكرر — للرجوع للمستند لاحقاً
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">إضافة أصناف</h3>
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => setShowAddMenu((v) => !v)}
                disabled={!!draft}
                className="text-xs text-primary-light flex items-center gap-1 px-3 py-2 rounded-xl border border-primary/30 hover:bg-primary/10 disabled:opacity-40"
              >
                ➕ إضافة صنف
              </button>
              {showAddMenu && (
                <div className="absolute left-0 top-full mt-2 z-20 min-w-[180px] rounded-xl border border-border bg-[#1a1f2e] shadow-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => startDraft("phone")}
                    className="w-full text-right px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2"
                  >
                    📱 موبايل
                  </button>
                  <button
                    type="button"
                    onClick={() => startDraft("accessory")}
                    className="w-full text-right px-4 py-3 text-sm hover:bg-white/5 flex items-center gap-2 border-t border-border"
                  >
                    🎧 إكسسوار / صنف
                  </button>
                </div>
              )}
            </div>
          </div>

          {!draft && confirmedItems.length === 0 && (
            <div className="glass-card p-8 text-center border border-dashed border-white/10">
              <p className="text-muted text-sm">لا توجد بنود بعد — اضغط «إضافة صنف» للبدء</p>
            </div>
          )}

          {draft?.lineType === "phone" && (
            <div className="space-y-3">
              <PhonePurchaseLineItem
                index={confirmedItems.filter((l) => l.lineType === "phone").length}
                item={draft.data}
                platforms={platforms}
                canRemove
                onChange={updatePhoneDraft}
                onRemove={cancelDraft}
                barcodeNameHint={draftBarcodeHint}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={cancelDraft} className="btn-outline px-6 text-sm">
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDraft()}
                  disabled={confirmingDraft}
                  className="btn-primary px-6 text-sm disabled:opacity-50"
                >
                  {confirmingDraft
                    ? "جاري الإضافة..."
                    : editingId
                      ? "تحديث في الجدول"
                      : "✅ إضافة للمستند"}
                </button>
              </div>
            </div>
          )}

          {draft?.lineType === "accessory" && (
            <div className="space-y-3">
              <AccessoryPurchaseLineItem
                index={confirmedItems.filter((l) => l.lineType === "accessory").length}
                item={draft.data}
                categories={categories}
                canRemove
                onChange={updateAccessoryDraft}
                onRemove={cancelDraft}
                barcodeNameHint={draftBarcodeHint}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={cancelDraft} className="btn-outline px-6 text-sm">
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDraft()}
                  disabled={confirmingDraft}
                  className="btn-primary px-6 text-sm disabled:opacity-50"
                >
                  {confirmingDraft
                    ? "جاري الإضافة..."
                    : editingId
                      ? "تحديث في الجدول"
                      : "✅ إضافة للمستند"}
                </button>
              </div>
            </div>
          )}
        </div>

        <PurchaseInvoiceLinesTable
          rows={tableRows}
          invoiceNumber={form.documentNumber}
          onEdit={editLine}
          onRemove={removeLine}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 glass-card p-5">
            <label className="block text-xs text-muted mb-1.5">ملاحظات المستند</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="glass-input min-h-[80px]"
            />
          </div>
          <div className="glass-card p-5 space-y-3">
            <div className="flex justify-between text-sm text-muted">
              <span>إجمالي الأصناف</span>
              <span className="font-bold tabular-nums text-base">{formatCurrency(subtotal)} ج.م</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-accent-green pt-3 border-t border-border">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(subtotal)} ج.م</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || confirmedItems.length === 0 || !!draft}
            className="btn-primary sm:px-10 disabled:opacity-40"
          >
            {loading ? "جاري الحفظ..." : "حفظ المستند"}
          </button>
          <Link href="/dashboard/documents" className="btn-outline sm:px-10 text-center">
            إلغاء
          </Link>
        </div>
      </form>
    </>
  );
}
