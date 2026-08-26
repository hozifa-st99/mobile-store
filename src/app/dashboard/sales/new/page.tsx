"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import CatalogAvailabilityModal from "@/components/sales/CatalogAvailabilityModal";
import SaleConfirmModal from "@/components/sales/SaleConfirmModal";
import SalePhoneInfoButton from "@/components/sales/SalePhoneInfoButton";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiFetch, apiJson } from "@/lib/api-client";
import { formatStoredDeviceImeis } from "@/lib/product-serial-imeis";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";

interface Product {
  id: string;
  name: string;
  brand: string;
  type: string;
  barcode?: string | null;
  quantity: number;
  purchasePrice: number;
  retailPrice: number;
}

interface Customer {
  id: string;
  nameAr: string;
  phone?: string | null;
}

interface BranchEmployee {
  id: string;
  employeeCode: string;
  nameAr: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  installment: "أقساط",
};

interface CartItem {
  lineId: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** أقل سعر بيع مسموح — سعر الشراء (لا يُغيّر سعر المنتج الأساسي) */
  minUnitPrice: number;
  /** سعر البيع الأساسي من المخزون — للمرجع فقط، لا يُحفظ على المنتج */
  catalogUnitPrice?: number;
  maxQty: number;
  /** كل IMEIs الجهاز للعرض — مثل 111 · 222 */
  imei?: string;
  /** IMEI الممسوح — للبحث في المخزون */
  scannedImei?: string;
  /** كل IMEIs الجهاز — لمنع التكرار */
  deviceImeis?: string[];
  barcode?: string;
}

function isPhoneDeviceLine(item: Pick<CartItem, "scannedImei" | "deviceImeis" | "imei">): boolean {
  return Boolean(item.scannedImei || item.deviceImeis?.length || item.imei);
}

function getPhoneLookupQuery(item: Pick<CartItem, "scannedImei" | "deviceImeis" | "barcode" | "imei">): string {
  return item.scannedImei || item.barcode || item.deviceImeis?.[0] || item.imei?.split(" · ")[0] || "";
}

function FieldLabel({
  emoji,
  children,
  className = "block text-xs text-muted mb-1.5",
}: {
  emoji: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        <span>{children}</span>
      </span>
    </label>
  );
}

function SummaryLabel({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{emoji}</span>
      <span>{children}</span>
    </span>
  );
}

function newLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function NewSalePage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const customerLookupRef = useRef<HTMLInputElement>(null);
  const priceAtFocusRef = useRef<Map<string, number>>(new Map());
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomerLookup, setShowCustomerLookup] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [phoneRegisteredHint, setPhoneRegisteredHint] = useState<string | null>(null);
  const [phoneLinkedCustomerId, setPhoneLinkedCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(14);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [catalogAvailabilityOpen, setCatalogAvailabilityOpen] = useState(false);
  const [branchEmployees, setBranchEmployees] = useState<BranchEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  useEffect(() => {
    apiJson<{ products?: Product[] }>("/api/products").then(({ data }) =>
      setProducts((data.products || []).filter((p) => p.quantity > 0))
    );
    apiJson<{ employees: BranchEmployee[] }>("/api/branch-employees").then(({ ok, data }) => {
      if (ok) setBranchEmployees(data.employees || []);
    });
  }, []);

  useEffect(() => {
    if (!showCustomerLookup) {
      setCustomerResults([]);
      return;
    }
    const q = customerSearch.trim();
    if (q.length < 1) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(() => {
      apiJson<{ customers?: Customer[] }>(
        `/api/customers?search=${encodeURIComponent(q)}`
      ).then(({ data }) => setCustomerResults(data.customers || []));
    }, 280);
    return () => clearTimeout(timer);
  }, [customerSearch, showCustomerLookup]);

  useEffect(() => {
    if (showCustomerLookup) {
      customerLookupRef.current?.focus();
    }
  }, [showCustomerLookup]);

  const normalizePhone = (value: string) => value.replace(/\s+/g, "").trim();

  const pickCustomer = (c: Customer) => {
    setCustomerId(c.id);
    setCustomerName(c.nameAr);
    setCustomerPhone(c.phone || "");
    setPhoneRegisteredHint(null);
    setPhoneLinkedCustomerId("");
    setCustomerSearch("");
    setCustomerResults([]);
    setShowCustomerLookup(false);
  };

  const checkPhoneRegistered = async (phone: string) => {
    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      setPhoneRegisteredHint(null);
      return;
    }

    const { ok, data } = await apiJson<{ customers?: Customer[] }>(
      `/api/customers?search=${encodeURIComponent(normalized)}`
    );
    if (!ok) return;

    const customers: Customer[] = data.customers || [];
    const match = customers.find((c) => normalizePhone(c.phone || "") === normalized);

    if (match) {
      setCustomerId(match.id);
      setCustomerName(match.nameAr);
      setPhoneLinkedCustomerId(match.id);
      setPhoneRegisteredHint(`⚠️ هذا الرقم مسجّل من قبل — ${match.nameAr}`);
    } else {
      setPhoneRegisteredHint(null);
      setPhoneLinkedCustomerId("");
      setCustomerId("");
    }
  };

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.barcode?.toLowerCase().includes(q) ?? false)
    );
  }, [products, search]);

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const effectiveTaxRate = taxEnabled ? Math.max(0, taxRate) : 0;
  const tax = effectiveTaxRate > 0 ? ((subtotal - discount) * effectiveTaxRate) / 100 : 0;
  const total = subtotal - discount + tax;

  const addAccessoryToCart = (p: Product) => {
    if (p.type === "phone") {
      toast.error("امسح IMEI أو الباركود لإضافة الموبايل");
      searchRef.current?.focus();
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (c) => c.productId === p.id && !isPhoneDeviceLine(c)
      );
      if (existing) {
        if (existing.quantity >= p.quantity) {
          toast.error("الكمية غير متوفرة");
          return prev;
        }
        return prev.map((c) =>
          c.lineId === existing.lineId
            ? {
                ...c,
                quantity: c.quantity + 1,
                barcode: c.barcode || p.barcode || undefined,
              }
            : c
        );
      }
      return [
        ...prev,
        {
          lineId: newLineId(),
          productId: p.id,
          description: p.name,
          quantity: 1,
          unitPrice: p.retailPrice,
          minUnitPrice: Math.max(0, Math.round((p.purchasePrice || 0) * 100) / 100),
          catalogUnitPrice: p.retailPrice,
          maxQty: p.quantity,
          barcode: p.barcode || undefined,
        },
      ];
    });
    setSearch("");
    setProductPickerOpen(false);
    toast.success("تمت الإضافة");
  };

  const addPhoneToCart = (device: {
    productId: string;
    name: string;
    imei: string | null;
    scannedImei?: string | null;
    imeiLabel?: string | null;
    imeis?: string[];
    barcode: string | null;
    retailPrice: number;
    unitCost?: number;
  }) => {
    const scannedImei = device.scannedImei || device.imei;
    const deviceImeis =
      device.imeis?.map((value) => value.trim()).filter(Boolean) ||
      (scannedImei ? [scannedImei] : []);
    const imeiLabel =
      device.imeiLabel ||
      (deviceImeis.length === 1 ? deviceImeis[0] : deviceImeis.join(" · "));

    if (!scannedImei && !device.barcode) {
      toast.error("الجهاز بدون IMEI أو باركود");
      return;
    }

    const duplicate = cart.some((c) => {
      if (device.barcode && c.barcode === device.barcode) return true;
      const cartImeis =
        c.deviceImeis?.length ? c.deviceImeis : c.scannedImei ? [c.scannedImei] : [];
      return deviceImeis.some((value) => cartImeis.includes(value));
    });
    if (duplicate) {
      toast.error("هذا الجهاز مضاف بالفعل");
      return;
    }

    const minUnitPrice = Math.max(0, Math.round((device.unitCost || 0) * 100) / 100);

    setCart((prev) => [
      ...prev,
      {
        lineId: newLineId(),
        productId: device.productId,
        description: device.name,
        quantity: 1,
        unitPrice: device.retailPrice,
        minUnitPrice,
        catalogUnitPrice: device.retailPrice,
        maxQty: 1,
        imei: imeiLabel || undefined,
        scannedImei: scannedImei || undefined,
        deviceImeis: deviceImeis.length > 0 ? deviceImeis : undefined,
        barcode: device.barcode || undefined,
      },
    ]);
    setSearch("");
    setProductPickerOpen(false);
    searchRef.current?.focus();
    toast.success("تمت إضافة الموبايل");
  };

  const handleSearchSubmit = async () => {
    const q = search.trim();
    if (!q) return;

    setSearching(true);
    try {
      const deviceRes = await apiFetch(`/api/devices/lookup?q=${encodeURIComponent(q)}`);
      if (deviceRes.ok) {
        const data = await deviceRes.json();
        addPhoneToCart(data.device);
        return;
      }

      const matches = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.brand.toLowerCase().includes(q.toLowerCase()) ||
          (p.barcode?.toLowerCase().includes(q.toLowerCase()) ?? false)
      );

      if (matches.length === 1) {
        addAccessoryToCart(matches[0]);
        return;
      }

      if (matches.length > 1) {
        toast.error("اختر الصنف من القائمة");
        return;
      }

      toast.error("لم يُعثر على صنف أو جهاز");
    } finally {
      setSearching(false);
    }
  };

  const removeFromCart = (lineId: string) => {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId));
  };

  const updateCartQty = (lineId: string, qty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.lineId !== lineId) return c;
        if (isPhoneDeviceLine(c)) return c;
        const next = Math.min(c.maxQty, Math.max(1, qty));
        return { ...c, quantity: next };
      })
    );
  };

  const updateCartPrice = (lineId: string, raw: string) => {
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    if (!Number.isFinite(parsed)) return;

    setCart((prev) =>
      prev.map((c) => {
        if (c.lineId !== lineId) return c;
        const next = Math.max(0, Math.round(parsed * 100) / 100);
        return { ...c, unitPrice: next };
      })
    );
  };

  const commitCartPrice = (lineId: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.lineId !== lineId) return c;

        const previousPrice =
          priceAtFocusRef.current.get(lineId) ??
          c.catalogUnitPrice ??
          c.unitPrice;

        if (c.unitPrice <= 0) {
          const fallback = c.catalogUnitPrice ?? previousPrice;
          toast.error("أدخل سعر بيع أكبر من صفر");
          return { ...c, unitPrice: fallback > 0 ? fallback : c.minUnitPrice };
        }

        if (c.minUnitPrice > 0 && c.unitPrice < c.minUnitPrice) {
          toast.error("سعر البيع غير مسموح");
          return { ...c, unitPrice: previousPrice };
        }

        priceAtFocusRef.current.set(lineId, c.unitPrice);
        return c;
      })
    );
    priceAtFocusRef.current.delete(lineId);
  };

  const handleSubmit = () => {
    if (cart.length === 0) {
      toast.error("أضف أصناف للفاتورة");
      return;
    }
    if (cart.some((item) => item.unitPrice <= 0)) {
      toast.error("أدخل سعر بيع أكبر من صفر لكل الأصناف");
      return;
    }
    if (cart.some((item) => item.unitPrice < item.minUnitPrice)) {
      toast.error("سعر البيع غير مسموح لبعض الأصناف");
      return;
    }
    if (branchEmployees.length === 0) {
      toast.error("أضف موظفاً من شاشة موظفي الفرع أولاً");
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSale = async () => {
    if (!selectedEmployeeId) {
      toast.error("اختر الموظف الذي كان مع الزبون");
      return;
    }
    setSaving(true);
    try {
      const { ok, data, status } = await runPendingOperation(() =>
        apiJson<{ message?: string; sale?: { id: string } }>("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: customerId || null,
            customerName: customerName.trim() || null,
            customerPhone: customerPhone.trim() || null,
            paymentMethod,
            discount,
            taxEnabled,
            taxRate: effectiveTaxRate,
            branchEmployeeId: selectedEmployeeId,
            items: cart.map((c) => ({
              productId: c.productId,
              description: c.description,
              quantity: c.quantity,
              unitPrice: c.unitPrice,
              imei: c.imei,
              scannedImei: c.scannedImei,
              barcode: c.barcode,
            })),
          }),
        })
      );

      if (!ok) {
        toast.error(
          status === 401
            ? "انتهت الجلسة — سجّل الدخول مرة أخرى"
            : data.message || "فشل الحفظ"
        );
        return;
      }
      setConfirmOpen(false);
      toast.success("تم حفظ الفاتورة");

      let autoCopies = 0;
      try {
        const printRes = await fetch("/api/settings/print", { credentials: "include" });
        const printData = await printRes.json();
        autoCopies = Number(printData.settings?.autoPrintCopies) || 0;
      } catch {
        /* ignore */
      }

      if (autoCopies > 0 && data.sale?.id) {
        router.push(`/dashboard/sales/${data.sale.id}/print?auto=${autoCopies}`);
        return;
      }

      router.push("/dashboard/sales");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/sales"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          ← رجوع للمبيعات
        </Link>
      </div>
      <PageHeader
        title="فاتورة بيع جديدة"
        subtitle="نقطة البيع — POS"
        showHomeButton
        centerAction={
          <button
            type="button"
            onClick={() => setCatalogAvailabilityOpen(true)}
            className="group inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-2xl border border-violet-400/35 bg-gradient-to-r from-violet-600/20 via-indigo-600/15 to-cyan-600/20 px-3 sm:px-4 text-sm font-bold text-white shadow-glow-sm transition-all hover:border-violet-300/50 hover:brightness-110"
            title="استعلام توفر المنتجات في الفروع"
          >
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <span className="text-base leading-none" aria-hidden>
                {em.product}
              </span>
              <span
                className="absolute -bottom-1 -start-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-500 text-[9px] ring-2 ring-[#0f0f14]"
                aria-hidden
              >
                {em.search}
              </span>
            </span>
            <span className="hidden sm:inline whitespace-nowrap">استعلام المخزون</span>
          </button>
        }
      />

      <CatalogAvailabilityModal
        open={catalogAvailabilityOpen}
        onClose={() => setCatalogAvailabilityOpen(false)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* الوسط/اليمين — بحث + جدول الأصnaف */}
        <div className="xl:col-span-8 space-y-0">
          <div className="glass-card">
            <div className="p-4 border-b border-border/50">
              <label className="block text-xs text-muted mb-2">
                بحث عن صنف · أو امسح IMEI / باركود
              </label>
              <div className="relative">
                <div className="flex items-center w-full rounded-xl border border-border bg-background-input focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setProductPickerOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setProductPickerOpen(false), 150);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSearchSubmit();
                      }
                      if (e.key === "Escape") {
                        setProductPickerOpen(false);
                      }
                    }}
                    placeholder="اسم الصنف أو IMEI / باركود..."
                    className="flex-1 min-w-0 bg-transparent border-0 py-2.5 px-3 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:ring-0"
                    disabled={searching}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleSearchSubmit()}
                    disabled={searching || !search.trim()}
                    className="shrink-0 mx-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/25 text-primary-light border border-primary/30 hover:bg-primary/35 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {searching ? "…" : "إضافة"}
                  </button>
                </div>
                {productPickerOpen && (
                  <ul
                    className="absolute z-30 top-[calc(100%+4px)] left-0 right-0 rounded-xl border border-border bg-background-card shadow-xl max-h-72 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {searchResults.length === 0 ? (
                      <li className="px-3 py-3 text-xs text-muted text-center">
                        {products.length === 0
                          ? "لا توجد أصناف متاحة في المخزون"
                          : "لا توجد نتائج مطابقة"}
                      </li>
                    ) : (
                      searchResults.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (p.type === "phone") {
                                toast.error("امسح IMEI أو الباركود لإضافة الموبايل");
                                searchRef.current?.focus();
                                return;
                              }
                              addAccessoryToCart(p);
                            }}
                            className="w-full text-right px-3 py-2.5 hover:bg-primary/10 border-b border-border/30 last:border-0 flex justify-between gap-4 items-center"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{p.name}</p>
                              <p className="text-xs text-muted-dark truncate">
                                {p.brand}
                                {p.type === "phone" ? " · موبايل" : ""}
                              </p>
                            </div>
                            <div className="shrink-0 flex items-center gap-3 text-xs tabular-nums">
                              <span className="text-muted whitespace-nowrap">
                                {p.quantity} قطعة
                              </span>
                              <span className="font-semibold text-primary-light whitespace-nowrap">
                                {formatCurrency(p.retailPrice)} ج.م
                              </span>
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div className="overflow-x-auto min-h-[320px]">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                    <th className="p-3 text-right font-medium w-10">#</th>
                    <ThEmoji emoji={em.product} className="text-right p-3 font-medium">
                      الصنف
                    </ThEmoji>
                    <th className="p-3 text-right font-medium">IMEI / باركود</th>
                    <th className="p-3 text-right font-medium">الكمية</th>
                    <ThEmoji emoji={em.salePrice} className="text-right p-3 font-medium">
                      سعر البيع
                    </ThEmoji>
                    <th className="p-3 text-right font-medium">الإجمالي</th>
                    <th className="p-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-16 text-center text-muted text-sm">
                        ابحث عن صنف أو امسح IMEI/باركود — الأصناف تظهر هنا
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr
                        key={item.lineId}
                        className="border-b border-border/40 hover:bg-white/[0.02]"
                      >
                        <td className="p-3 text-xs text-muted">{idx + 1}</td>
                        <td className="p-3 text-sm text-white">{item.description}</td>
                        <td className="p-3 text-xs text-muted-dark">
                          {item.imei && <div>IMEI: {formatStoredDeviceImeis(item.imei)}</div>}
                          {item.barcode && <div>باركود: {item.barcode}</div>}
                          {!item.imei && !item.barcode && "—"}
                        </td>
                        <td className="p-3">
                          {isPhoneDeviceLine(item) ? (
                            <span className="text-sm tabular-nums">1</span>
                          ) : (
                            <input
                              type="number"
                              min={1}
                              max={item.maxQty}
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartQty(item.lineId, Number(e.target.value))
                              }
                              className="w-16 glass-input text-sm tabular-nums py-1"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step={0.01}
                            value={item.unitPrice}
                            onFocus={() => {
                              priceAtFocusRef.current.set(item.lineId, item.unitPrice);
                            }}
                            onChange={(e) => updateCartPrice(item.lineId, e.target.value)}
                            onBlur={() => commitCartPrice(item.lineId)}
                            className="w-24 glass-input text-sm tabular-nums py-1"
                          />
                        </td>
                        <td className="p-3 text-sm font-semibold tabular-nums">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPhoneDeviceLine(item) ? (
                              <SalePhoneInfoButton lookupQuery={getPhoneLookupQuery(item)} />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.lineId)}
                              className="text-red-400 hover:text-red-300"
                              title="حذف"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* الشمال — تفاصيل الفاتورة */}
        <div className="xl:col-span-4">
          <div className="glass-card p-5 sticky top-4 space-y-4">
            <h2 className="text-sm font-bold text-white inline-flex items-center gap-1.5">
              <span aria-hidden>{em.invoice}</span>
              <span>الفاتورة</span>
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel emoji={em.customers} className="text-xs text-muted">
                  العميل
                </FieldLabel>
                <button
                  type="button"
                  onClick={() => setShowCustomerLookup((v) => !v)}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-colors ${
                    showCustomerLookup
                      ? "border-primary/50 bg-primary/20 text-primary-light"
                      : "border-border text-muted hover:border-primary/40 hover:text-primary-light"
                  }`}
                  title="بحث عن عميل مسجّل"
                >
                  {em.search}
                </button>
              </div>

              {showCustomerLookup && (
                <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <input
                    ref={customerLookupRef}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="بحث سريع — اسم أو هاتف..."
                    className="w-full bg-background-input border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-primary/50"
                  />
                  {customerSearch.trim() && customerResults.length === 0 && (
                    <p className="text-xs text-muted px-1">لا توجد نتائج</p>
                  )}
                  {customerResults.length > 0 && (
                    <ul className="max-h-36 overflow-y-auto rounded-lg border border-border/50 bg-background-card">
                      {customerResults.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => pickCustomer(c)}
                            className="w-full text-right px-3 py-2 hover:bg-primary/10 border-b border-border/30 last:border-0"
                          >
                            <p className="text-sm text-white">{c.nameAr}</p>
                            {c.phone && (
                              <p className="text-xs text-muted-dark" dir="ltr">
                                {c.phone}
                              </p>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <FieldLabel emoji={em.name}>اسم العميل</FieldLabel>
                <input
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (!phoneLinkedCustomerId) {
                      setCustomerId("");
                    }
                  }}
                  placeholder="اسم العميل..."
                  className="glass-input text-sm w-full py-2.5"
                />
                {phoneLinkedCustomerId && (
                  <p className="text-[11px] text-muted mt-1">
                    تعديل الاسم سيحدّث بيانات العميل المسجّل
                  </p>
                )}
              </div>
              <div>
                <FieldLabel emoji={em.phone}>رقم الهاتف</FieldLabel>
                <input
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setCustomerId("");
                    setPhoneLinkedCustomerId("");
                    setPhoneRegisteredHint(null);
                  }}
                  onBlur={() => void checkPhoneRegistered(customerPhone)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="glass-input text-sm w-full py-2.5 text-left"
                />
                {phoneRegisteredHint && (
                  <p className="text-xs text-accent-orange mt-1.5">{phoneRegisteredHint}</p>
                )}
              </div>
              <div>
                <FieldLabel emoji={em.payment}>طريقة الدفع</FieldLabel>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="glass-input text-sm w-full"
                >
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="installment">أقساط</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-4">
              <div className="flex justify-between text-muted">
                <SummaryLabel emoji={em.product}>عدد الأصناف</SummaryLabel>
                <span>{cart.length}</span>
              </div>
              <div className="flex justify-between text-muted">
                <SummaryLabel emoji={em.total}>المجموع</SummaryLabel>
                <span className="tabular-nums">{formatCurrency(subtotal)} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <SummaryLabel emoji="🏷️">خصم</SummaryLabel>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-24 bg-background-input border border-border rounded-lg px-2 py-1 text-white text-left"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-muted">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxEnabled}
                    onChange={(e) => setTaxEnabled(e.target.checked)}
                    className="rounded border-border"
                  />
                  <SummaryLabel emoji="🧮">ضريبة</SummaryLabel>
                </label>
                {taxEnabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-16 bg-background-input border border-border rounded-lg px-2 py-1 text-white text-left"
                    />
                    <span className="text-xs">%</span>
                    <span className="tabular-nums text-xs">{formatCurrency(tax)}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-dark">بدون ضريبة</span>
                )}
              </div>
              <div className="flex justify-between text-white font-bold text-lg pt-3 border-t border-border">
                <SummaryLabel emoji={em.total}>الإجمالي</SummaryLabel>
                <span className="tabular-nums text-accent-green">
                  {formatCurrency(total)} ج.م
                </span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || cart.length === 0}
              className="btn-primary w-full"
            >
              {saving ? "جاري الحفظ..." : "إتمام البيع"}
            </button>
          </div>
        </div>
      </div>

      <SaleConfirmModal
        open={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        onConfirm={confirmSale}
        saving={saving}
        customerLabel={
          customerName.trim() ||
          customerPhone.trim() ||
          (customerId ? "عميل مسجّل" : "عميل نقدي")
        }
        paymentLabel={PAYMENT_LABELS[paymentMethod] || paymentMethod}
        itemCount={cart.length}
        subtotal={subtotal}
        discount={discount}
        tax={tax}
        total={total}
        items={cart.map((c) => ({
          description: c.description,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        }))}
        employees={branchEmployees}
        selectedEmployeeId={selectedEmployeeId}
        onEmployeeChange={setSelectedEmployeeId}
      />
    </>
  );
}
