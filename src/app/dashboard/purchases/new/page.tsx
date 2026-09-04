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
import PurchaseCounterpartyQuickAdd, {
  PurchaseCounterpartyQuickAddTrigger,
} from "@/components/purchases/PurchaseCounterpartyQuickAdd";
import PurchaseInvoiceLinesTable from "@/components/purchases/PurchaseInvoiceLinesTable";
import PurchaseInvoiceExpenses from "@/components/purchases/PurchaseInvoiceExpenses";
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
import {
  computeLineExpenses,
  findRetailBelowCostAfterExpense,
  totalExpenseAmount,
  type PurchaseInvoiceExpense,
} from "@/lib/purchase-expense-alloc";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";
import { type PurchaseCounterpartyMode } from "@/lib/supplier-kind";

interface Supplier {
  id: string;
  nameAr: string;
}

interface CustomerOption {
  id: string;
  nameAr: string;
}

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

function purchaseLineLabel(
  line: ConfirmedPurchaseLine,
  platforms: PhonePlatformOption[],
  categories: ItemCategoryOption[]
): string {
  return buildInvoiceLineRow(line, platforms, categories).name;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [platforms, setPlatforms] = useState<PhonePlatformOption[]>([]);
  const [categories, setCategories] = useState<ItemCategoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingDraft, setConfirmingDraft] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [counterpartyMode, setCounterpartyMode] = useState<PurchaseCounterpartyMode>("wholesale");
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [form, setForm] = useState({
    supplierId: "",
    customerId: "",
    invoiceNumber: "",
    dueDate: "",
    notes: "",
    discount: 0,
    applyTax: false,
    taxRate: 14,
    paymentType: "full_cash" as "full_cash" | "credit" | "partial_credit",
    partialPaidAmount: "",
    cashSource: "shift" as "shift" | "vault",
  });

  const loadNextInvoiceNumber = async () => {
    const { ok, data } = await apiJson<{ invoiceNumber?: string; message?: string }>(
      "/api/purchases/next-invoice-number"
    );
    if (ok && data.invoiceNumber) {
      setForm((prev) => ({ ...prev, invoiceNumber: data.invoiceNumber! }));
      return;
    }
    toast.error(data.message || "تعذر توليد رقم الفاتورة — حدّث الصفحة");
  };

  const [confirmedItems, setConfirmedItems] = useState<ConfirmedPurchaseLine[]>([]);
  const [draft, setDraft] = useState<PurchaseLineItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expensesEnabled, setExpensesEnabled] = useState(false);
  const [expenses, setExpenses] = useState<PurchaseInvoiceExpense[]>([]);

  const reloadSuppliers = async () => {
    const { ok, data } = await apiJson<{ suppliers: Supplier[] }>(
      "/api/suppliers?kind=wholesale"
    );
    if (ok) setSuppliers(data.suppliers || []);
  };

  const reloadCustomers = async () => {
    const { ok, data } = await apiJson<{ customers: CustomerOption[] }>("/api/customers");
    if (ok) setCustomers(data.customers || []);
  };

  const appendSupplier = (party: { id: string; nameAr: string }) => {
    setSuppliers((prev) => {
      if (prev.some((s) => s.id === party.id)) return prev;
      return [...prev, party].sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));
    });
  };

  const appendCustomer = (party: { id: string; nameAr: string }) => {
    setCustomers((prev) => {
      if (prev.some((c) => c.id === party.id)) return prev;
      return [...prev, party].sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"));
    });
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers?kind=wholesale", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/customers", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/settings/phone-platforms", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/settings/item-categories", { credentials: "include" }).then((r) => r.json()),
    ]).then(([sup, cust, plat, cat]) => {
      setSuppliers(sup.suppliers || []);
      setCustomers(cust.customers || []);
      setPlatforms(plat.platforms || []);
      setCategories(cat.categories || []);
    });
    void loadNextInvoiceNumber();
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
  const expenseTotal = expensesEnabled ? totalExpenseAmount(expenses) : 0;
  const subtotalWithExpenses = subtotal + expenseTotal;
  const taxAmount = form.applyTax
    ? ((subtotalWithExpenses - form.discount) * form.taxRate) / 100
    : 0;
  const total = subtotalWithExpenses - form.discount + taxAmount;

  const cashDueNow =
    form.paymentType === "full_cash"
      ? total
      : form.paymentType === "partial_credit"
        ? Math.max(0, Number(form.partialPaidAmount) || 0)
        : 0;

  const creditRemaining = Math.max(0, total - cashDueNow);

  const requiresCashSource = cashDueNow > 0;

  const lineExpenseResults = useMemo(
    () =>
      expensesEnabled && expenses.length > 0
        ? computeLineExpenses(confirmedItems, expenses)
        : [],
    [confirmedItems, expenses, expensesEnabled]
  );

  const expenseByLineId = useMemo(
    () => new Map(lineExpenseResults.map((e) => [e.lineId, e])),
    [lineExpenseResults]
  );

  const hasExpenses = expensesEnabled && expenses.length > 0;

  const warnRetailAfterExpense = (nextExpenses: PurchaseInvoiceExpense[]) => {
    if (!expensesEnabled || nextExpenses.length === 0) return;
    const err = findRetailBelowCostAfterExpense(
      confirmedItems,
      nextExpenses,
      (line) => purchaseLineLabel(line, platforms, categories)
    );
    if (err) {
      toast.warning(`${err} — لن يمكن حفظ الفاتورة حتى تعدّل سعر البيع`);
    }
  };

  const tableRows = useMemo(
    () =>
      confirmedItems.map((line) => {
        const row = buildInvoiceLineRow(line, platforms, categories);
        const exp = expenseByLineId.get(line.id);
        if (exp && hasExpenses) {
          return {
            ...row,
            unitPriceAfter: exp.unitPriceAfter,
            expenseShare: exp.expenseShare,
            totalAfter: exp.lineTotalAfter,
          };
        }
        return row;
      }),
    [confirmedItems, platforms, categories, expenseByLineId, hasExpenses]
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
      if (
        purchasePrice > 0 &&
        retailPrice > 0 &&
        retailPrice === purchasePrice
      ) {
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
      toast.success(editingId ? "تم تحديث الصنف" : "تمت إضافة الصنف للفاتورة");
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
    if (counterpartyMode === "customer") {
      if (!form.customerId) {
        toast.error("اختر العميل");
        return;
      }
    } else if (!form.supplierId) {
      toast.error("اختر المورد");
      return;
    }
    if (!form.invoiceNumber.trim()) {
      toast.error("رقم الفاتورة مطلوب");
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

    if (hasExpenses) {
      const retailErr = findRetailBelowCostAfterExpense(
        confirmedItems,
        expenses,
        (line) => purchaseLineLabel(line, platforms, categories)
      );
      if (retailErr) {
        toast.error(retailErr);
        return;
      }
    }

    if (form.paymentType === "partial_credit") {
      const partial = Number(form.partialPaidAmount);
      if (!Number.isFinite(partial) || partial <= 0 || partial >= total) {
        toast.error("أدخل مبلغاً مدفوعاً صحيحاً للأجل الجزئي (أقل من الإجمالي)");
        return;
      }
    }

    if (requiresCashSource && !form.cashSource) {
      toast.error("اختر مصدر الدفع النقدي");
      return;
    }

    setLoading(true);

    try {
      const payloadItems = confirmedItems.map((line) => {
        const exp = expenseByLineId.get(line.id);
        const unitPriceAfter =
          exp && hasExpenses ? Math.round(exp.unitPriceAfter * 100) / 100 : line.data.unitPrice;
        const unitPriceBefore = line.data.unitPrice;

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
            unitPrice: unitPriceAfter,
            unitPriceBefore,
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
          unitPrice: unitPriceAfter,
          unitPriceBefore,
          retailPrice: item.retailPrice,
          minQuantity: item.minQuantity,
          barcode: item.barcode.trim() || undefined,
          deviceCondition: item.deviceCondition,
          itemNotes: item.itemNotes.trim() || null,
        };
      });

      const expenseNotes =
        hasExpenses
          ? `\nمصاريف الفاتورة: ${expenses.map((e) => `${e.nameAr} (${e.amount} ج.م)`).join(" | ")}`
          : "";

      await runPendingOperation(async () => {
        const res = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...form,
            counterpartyMode,
            customerId: counterpartyMode === "customer" ? form.customerId : undefined,
            supplierId: counterpartyMode === "customer" ? undefined : form.supplierId,
            notes: (form.notes || "") + expenseNotes,
            taxRate: form.applyTax ? form.taxRate : 0,
            applyTax: form.applyTax,
            items: payloadItems,
            status: "completed",
            paymentType: form.paymentType,
            paidAmount:
              form.paymentType === "partial_credit" ? Number(form.partialPaidAmount) : undefined,
            cashSource: requiresCashSource ? form.cashSource : undefined,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success("تم حفظ فاتورة الشراء");
          router.push("/dashboard/purchases");
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
          href="/dashboard/purchases"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <span className="text-lg">➡️</span> رجوع للمشتريات
        </Link>
      </div>

      <PageHeader
        title="فاتورة شراء"
        subtitle="أضف الأصناف للجدول ثم احفظ الفاتورة"
        showHomeButton
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
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-border/60">
            <span className="text-xs text-muted shrink-0">مصدر الشراء:</span>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-background-input/40">
              <button
                type="button"
                onClick={() => {
                  setCounterpartyMode("wholesale");
                  setForm((prev) => ({ ...prev, customerId: "", supplierId: "" }));
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  counterpartyMode === "wholesale"
                    ? "bg-primary/20 text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                مورد (جملة)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCounterpartyMode("customer");
                  setForm((prev) => ({ ...prev, customerId: "", supplierId: "" }));
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  counterpartyMode === "customer"
                    ? "bg-primary/20 text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                عميل
              </button>
            </div>
            <PurchaseCounterpartyQuickAddTrigger onClick={() => setQuickAddOpen(true)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">
            <div className="min-w-0">
              <label className="block text-xs text-muted mb-1.5">رقم الفاتورة (معرّف ثابت)</label>
              <div className="glass-input flex min-h-11 items-center justify-between px-4 py-2.5 text-sm font-bold leading-normal text-accent-green bg-white/[0.03] cursor-not-allowed select-all">
                <span className="truncate">{form.invoiceNumber || "جاري التوليد..."}</span>
                <span className="text-[10px] text-muted font-normal shrink-0">🔒</span>
              </div>
            </div>

            <div className="min-w-0">
              <label className="block text-xs text-muted mb-1.5">
                {counterpartyMode === "customer" ? "العميل *" : "المورد *"}
              </label>
              {counterpartyMode === "customer" ? (
                <select
                  required
                  value={form.customerId}
                  onChange={(e) =>
                    setForm({ ...form, customerId: e.target.value, supplierId: "" })
                  }
                  className="glass-input w-full min-h-11 py-2.5 leading-normal"
                >
                  <option value="">— اختر —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  required
                  value={form.supplierId}
                  onChange={(e) =>
                    setForm({ ...form, supplierId: e.target.value, customerId: "" })
                  }
                  className="glass-input w-full min-h-11 py-2.5 leading-normal"
                >
                  <option value="">— اختر —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="min-w-0">
              <label className="block text-xs text-muted mb-1.5">تاريخ الاستحقاق</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="glass-input w-full min-h-11 py-2.5 leading-normal"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-dark mt-2">
            يُولَّد رقم الفاتورة تلقائياً ولا يتكرر — للرجوع للفاتورة لاحقاً
          </p>

          <div className="mt-5 pt-5 border-t border-border space-y-4">
            <h3 className="text-sm font-semibold text-white">طريقة الدفع</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  { value: "full_cash", label: "دفع كلي" },
                  { value: "credit", label: "أجل" },
                  { value: "partial_credit", label: "أجل جزئي" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                    form.paymentType === opt.value
                      ? "border-primary bg-primary/10 text-white"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentType"
                    value={opt.value}
                    checked={form.paymentType === opt.value}
                    onChange={() => setForm({ ...form, paymentType: opt.value })}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              ))}
            </div>

            {form.paymentType === "partial_credit" && (
              <div className="max-w-xs">
                <label className="block text-xs text-muted mb-1.5">المبلغ المدفوع الآن</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.partialPaidAmount}
                  onChange={(e) => setForm({ ...form, partialPaidAmount: e.target.value })}
                  className="glass-input"
                  placeholder="0.00"
                />
              </div>
            )}

            {requiresCashSource && (
              <div>
                <p className="text-xs text-muted mb-2">مصدر الدفع النقدي ({formatCurrency(cashDueNow)} ج.م)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  {(
                    [
                      { value: "shift", label: "من الوردية (الخزنة الحالية)" },
                      { value: "vault", label: "من خزنة الفرع" },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${
                        form.cashSource === opt.value
                          ? "border-accent-green bg-accent-green/10 text-white"
                          : "border-border text-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cashSource"
                        value={opt.value}
                        checked={form.cashSource === opt.value}
                        onChange={() => setForm({ ...form, cashSource: opt.value })}
                        className="accent-accent-green"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.paymentType !== "full_cash" && (
              <p className="text-xs text-accent-orange">
                المتبقي على الحساب (أجل):{" "}
                <span className="font-bold tabular-nums">{formatCurrency(creditRemaining)} ج.م</span>
              </p>
            )}
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
                      : "✅ إضافة للفاتورة"}
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
                      : "✅ إضافة للفاتورة"}
                </button>
              </div>
            </div>
          )}
        </div>

        <PurchaseInvoiceLinesTable
          rows={tableRows}
          invoiceNumber={form.invoiceNumber}
          hasExpenses={hasExpenses}
          onEdit={editLine}
          onRemove={removeLine}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 glass-card p-5">
            <label className="block text-xs text-muted mb-1.5">ملاحظات الفاتورة</label>
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
            {hasExpenses && (
              <div className="flex justify-between text-sm text-accent-orange">
                <span>مصاريف الفاتورة</span>
                <span className="font-bold tabular-nums text-base">
                  + {formatCurrency(expenseTotal)} ج.م
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">الخصم</span>
              <input
                type="number"
                min={0}
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                className="glass-input w-24 text-sm py-1"
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.applyTax}
                  onChange={(e) => setForm({ ...form, applyTax: e.target.checked })}
                  className="rounded border-border"
                />
                تطبيق ضريبة
              </label>
              {form.applyTax && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.taxRate}
                    onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
                    className="glass-input w-16 text-sm py-1 text-center"
                  />
                  <span className="text-muted">%</span>
                </div>
              )}
            </div>
            {form.applyTax && (
              <div className="flex justify-between text-sm text-muted">
                <span>قيمة الضريبة</span>
                <span className="font-bold tabular-nums">{formatCurrency(taxAmount)} ج.م</span>
              </div>
            )}
            <PurchaseInvoiceExpenses
              enabled={expensesEnabled}
              onEnabledChange={setExpensesEnabled}
              expenses={expenses}
              lines={confirmedItems}
              onAdd={(exp) => {
                const next = [...expenses, exp];
                setExpenses(next);
                warnRetailAfterExpense(next);
              }}
              onUpdate={(exp) => {
                const next = expenses.map((e) => (e.id === exp.id ? exp : e));
                setExpenses(next);
                warnRetailAfterExpense(next);
              }}
              onRemove={(id) => setExpenses((prev) => prev.filter((e) => e.id !== id))}
            />
            <div className="flex justify-between text-xl font-bold text-accent-green pt-3 border-t border-border">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(total)} ج.م</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || confirmedItems.length === 0 || !!draft}
            className="btn-primary sm:px-10 disabled:opacity-40"
          >
            {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
          </button>
          <Link href="/dashboard/purchases" className="btn-outline sm:px-10 text-center">
            إلغاء
          </Link>
        </div>
      </form>

      <PurchaseCounterpartyQuickAdd
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        preferredKind={counterpartyMode === "customer" ? "customer" : "supplier"}
        onSupplierCreated={async (party) => {
          appendSupplier(party);
          setCounterpartyMode("wholesale");
          setForm((prev) => ({ ...prev, supplierId: party.id, customerId: "" }));
          await reloadSuppliers();
        }}
        onCustomerCreated={async (party) => {
          appendCustomer(party);
          setCounterpartyMode("customer");
          setForm((prev) => ({ ...prev, customerId: party.id, supplierId: "" }));
          await reloadCustomers();
        }}
      />
    </>
  );
}
