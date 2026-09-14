"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";

import BarcodeScannerModal from "@/components/barcode/BarcodeScannerModal";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import { em, ThEmoji } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/utils";

type TabKey = "available" | "reserved";

interface CustomerOption {
  id: string;
  nameAr: string;
  phone?: string | null;
}

interface AvailablePhone {
  serialId: string;
  productId: string;
  barcode: string | null;
  imeiLabel: string;
  retailPrice: number;
  product: {
    nameAr: string;
    brand: string | null;
    color: string | null;
    storage: string | null;
  };
}

interface ReservationRow {
  id: string;
  status: string;
  notes: string | null;
  reservedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  saleId: string | null;
  customer: CustomerOption;
  reservedBy: { id: string; nameAr: string } | null;
  serial: {
    id: string;
    imeiLabel: string;
    barcode: string | null;
    retailPrice: number;
    product: {
      nameAr: string;
      brand: string | null;
      color: string | null;
      storage: string | null;
    };
  };
}

function phoneTitle(row: { product: { nameAr: string; brand: string | null } }) {
  return [row.product.nameAr, row.product.brand].filter(Boolean).join(" — ");
}

function phoneMeta(row: {
  product: { color: string | null; storage: string | null };
}) {
  return [row.product.storage, row.product.color].filter(Boolean).join(" · ") || "—";
}

function historyStatusLabel(status: string) {
  if (status === "completed") return "تم البيع";
  if (status === "cancelled") return "تم الإلغاء";
  return status;
}

function historyFinishedAt(row: ReservationRow) {
  const value = row.completedAt || row.cancelledAt;
  return value ? new Date(value).toLocaleString("ar-EG") : "—";
}

const reservationBtnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 min-h-[2.25rem] text-xs font-semibold whitespace-nowrap transition-all duration-200";

const reservationBtnView = `${reservationBtnBase} border border-primary/35 bg-primary/10 text-primary-light hover:bg-primary/20 hover:text-white`;

const reservationBtnSale = `${reservationBtnBase} border border-transparent text-white bg-gradient-primary shadow-glow hover:brightness-110 active:scale-[0.98]`;

const reservationBtnCancel = `${reservationBtnBase} border border-red-500/35 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300`;

export default function PhoneReservationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("available");
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyScannerOpen, setHistoryScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [phones, setPhones] = useState<AvailablePhone[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [history, setHistory] = useState<ReservationRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyExpandedId, setHistoryExpandedId] = useState<string | null>(null);

  const [reserveOpen, setReserveOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<AvailablePhone | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomerLookup, setShowCustomerLookup] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ReservationRow | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const customerLookupRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tab, search });
    const { ok, data } = await apiJson<{
      phones?: AvailablePhone[];
      reservations?: ReservationRow[];
    }>(`/api/phone-reservations?${params}`);
    if (ok) {
      if (tab === "available") setPhones(data.phones || []);
      else setReservations(data.reservations || []);
    }
    setLoading(false);
  }, [tab, search]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historySearch.trim()) params.set("search", historySearch.trim());
    const { ok, data } = await apiJson<{ history?: ReservationRow[] }>(
      `/api/phone-reservations/history?${params.toString()}`
    );
    if (ok) setHistory(data.history || []);
    setHistoryLoading(false);
  }, [historySearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    if (tab !== "reserved") return;
    const timer = setTimeout(() => {
      void loadHistory();
    }, historySearch ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadHistory, historySearch, tab]);

  useEffect(() => {
    if (!reserveOpen || !showCustomerLookup) {
      setCustomerResults([]);
      return;
    }
    const q = customerSearch.trim();
    const timer = setTimeout(() => {
      void apiJson<{ customers?: CustomerOption[] }>(
        `/api/customers?search=${encodeURIComponent(q)}`
      ).then(({ data }) => setCustomerResults(data.customers || []));
    }, q ? 280 : 0);
    return () => clearTimeout(timer);
  }, [customerSearch, reserveOpen, showCustomerLookup]);

  useEffect(() => {
    if (showCustomerLookup) {
      customerLookupRef.current?.focus();
    }
  }, [showCustomerLookup]);

  const pickCustomer = (customer: CustomerOption) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.nameAr);
    setCustomerPhone(customer.phone?.trim() || "");
    setCustomerSearch("");
    setCustomerResults([]);
    setShowCustomerLookup(false);
  };

  const openReserve = (phone: AvailablePhone) => {
    setSelectedPhone(phone);
    setSelectedCustomerId("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerSearch("");
    setCustomerResults([]);
    setShowCustomerLookup(false);
    setNotes("");
    setReserveOpen(true);
  };

  const submitReserve = async () => {
    if (!selectedPhone || !selectedCustomerId) {
      toast.error("اختر العميل");
      return;
    }
    setSaving(true);
    const { ok, data } = await apiJson<{ message?: string }>("/api/phone-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serialId: selectedPhone.serialId,
        customerId: selectedCustomerId,
        notes,
      }),
    });
    setSaving(false);
    if (!ok) {
      toast.error(data.message || "تعذّر الحجز");
      return;
    }
    toast.success("تم حجز الجهاز");
    setReserveOpen(false);
    setTab("reserved");
    void load();
  };

  const confirmCancelReservation = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const { ok, data } = await apiJson<{ message?: string }>(
      `/api/phone-reservations/${cancelTarget.id}`,
      { method: "DELETE" }
    );
    setCancelling(false);
    if (!ok) {
      toast.error(data.message || "تعذّر الإلغاء");
      return;
    }
    toast.success("تم إلغاء الحجز");
    if (expandedId === cancelTarget.id) setExpandedId(null);
    setCancelTarget(null);
    void load();
    void loadHistory();
  };

  const completeSale = (id: string) => {
    router.push(`/dashboard/sales/new?reservationId=${encodeURIComponent(id)}`);
  };

  const handleBarcodeScan = useCallback((value: string) => {
    setScannerOpen(false);
    setSearch(value.trim());
  }, []);

  const handleHistoryBarcodeScan = useCallback((value: string) => {
    setHistoryScannerOpen(false);
    setHistorySearch(value.trim());
  }, []);

  return (
    <>
      <PageHeader
        title="حجز هاتف"
        subtitle="حجز موبايلات الفرع — المحجوز لا يظهر «متاح» في استعلام الفروع الأخرى"
        showHomeButton
      />

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      <BarcodeScannerModal
        open={historyScannerOpen}
        onClose={() => setHistoryScannerOpen(false)}
        onScan={handleHistoryBarcodeScan}
      />

      <div className="glass-card p-4 mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("available")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === "available"
                ? "bg-primary/25 text-primary-light border border-primary/40"
                : "bg-white/5 text-muted border border-white/10"
            }`}
          >
            📱 متاح للحجز
          </button>
          <button
            type="button"
            onClick={() => setTab("reserved")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === "reserved"
                ? "bg-accent-orange/20 text-accent-orange border border-accent-orange/40"
                : "bg-white/5 text-muted border border-white/10"
            }`}
          >
            🔒 محجوز
          </button>
        </div>

        <div
          className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 ${
            tab === "available"
              ? "border-primary/30 bg-primary/10"
              : "border-accent-orange/30 bg-accent-orange/10"
          }`}
        >
          <span
            className={`text-2xl font-bold tabular-nums ${
              tab === "available" ? "text-primary-light" : "text-accent-orange"
            }`}
          >
            {tab === "available" ? phones.length : reservations.length}
          </span>
          <span className="text-sm text-muted">
            {tab === "available" ? "جهاز متاح للحجز" : "حجز نشط"}
          </span>
        </div>

        <div className="flex items-center w-full rounded-xl border border-border bg-background-input focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث: اسم الموبايل · IMEI · باركود"
            className="flex-1 min-w-0 bg-transparent border-0 py-2.5 px-3 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            disabled={loading}
            className="shrink-0 mx-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/35 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="مسح باركود / IMEI بالكاميرا"
            aria-label="مسح باركود / IMEI بالكاميرا"
          >
            <ScanLine className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-muted">جاري التحميل...</p>
        ) : tab === "available" ? (
          phones.length === 0 ? (
            <p className="p-8 text-center text-muted">لا توجد موبايلات متاحة للحجز</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted border-b border-white/10">
                    <ThEmoji emoji={em.product} className="text-right p-4">
                      الجهاز
                    </ThEmoji>
                    <ThEmoji emoji={em.imei} className="text-right p-4">
                      IMEI / باركود
                    </ThEmoji>
                    <ThEmoji emoji={em.salePrice} className="text-right p-4">
                      سعر البيع
                    </ThEmoji>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody>
                  {phones.map((phone) => (
                    <tr key={phone.serialId} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="p-4">
                        <p className="font-semibold text-white">{phoneTitle(phone)}</p>
                        <p className="text-xs text-muted mt-1">{phoneMeta(phone)}</p>
                      </td>
                      <td className="p-4 text-primary-light">{phone.imeiLabel}</td>
                      <td className="p-4 text-accent-green font-bold">
                        {formatCurrency(phone.retailPrice)} ج.م
                      </td>
                      <td className="p-4 text-left">
                        <button
                          type="button"
                          onClick={() => openReserve(phone)}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          حجز
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : reservations.length === 0 ? (
          <p className="p-8 text-center text-muted">لا توجد حجوزات نشطة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-white/10">
                  <ThEmoji emoji={em.product} className="text-right p-4">
                    الجهاز
                  </ThEmoji>
                  <ThEmoji emoji={em.customer} className="text-right p-4">
                    العميل
                  </ThEmoji>
                  <ThEmoji emoji={em.date} className="text-right p-4">
                    تاريخ الحجز
                  </ThEmoji>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {reservations.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="p-4">
                        <p className="font-semibold text-white">{phoneTitle(row.serial)}</p>
                        <p className="text-xs text-muted mt-1">{row.serial.imeiLabel}</p>
                      </td>
                      <td className="p-4 text-white">{row.customer.nameAr}</td>
                      <td className="p-4 text-muted">
                        {new Date(row.reservedAt).toLocaleString("ar-EG")}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 justify-end min-w-[11rem]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((current) => (current === row.id ? null : row.id))
                            }
                            className={reservationBtnView}
                          >
                            <span className="text-base leading-none shrink-0">{em.view}</span>
                            {expandedId === row.id ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                          </button>
                          <button
                            type="button"
                            onClick={() => completeSale(row.id)}
                            className={reservationBtnSale}
                          >
                            <span className="text-base leading-none shrink-0">{em.salePrice}</span>
                            إكمال البيع
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget(row)}
                            className={reservationBtnCancel}
                          >
                            <span className="text-base leading-none shrink-0">{em.delete}</span>
                            إلغاء الحجز
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === row.id ? (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={4} className="p-4 text-sm text-muted space-y-2">
                          <p>
                            <span className="text-white font-medium">العميل: </span>
                            {row.customer.nameAr}
                            {row.customer.phone ? ` — ${row.customer.phone}` : ""}
                          </p>
                          <p>
                            <span className="text-white font-medium">تاريخ الحجز: </span>
                            {new Date(row.reservedAt).toLocaleString("ar-EG")}
                          </p>
                          {row.reservedBy ? (
                            <p>
                              <span className="text-white font-medium">بواسطة: </span>
                              {row.reservedBy.nameAr}
                            </p>
                          ) : null}
                          <p>
                            <span className="text-white font-medium">ملاحظات: </span>
                            {row.notes?.trim() || "—"}
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tab === "reserved" ? (
        <>
      <div className="glass-card p-4 mt-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">سجل الحجوزات المنتهية</h2>
          <p className="text-xs text-muted mt-1">
            {historySearch.trim()
              ? "نتائج البحث من قاعدة البيانات"
              : "أحدث 50 حجزاً (تم البيع أو الإلغاء)"}
          </p>
        </div>

        <div className="flex items-center w-full rounded-xl border border-border bg-background-input focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
          <input
            type="search"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="بحث: اسم الموبايل · IMEI · باركود"
            className="flex-1 min-w-0 bg-transparent border-0 py-2.5 px-3 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={() => setHistoryScannerOpen(true)}
            disabled={historyLoading}
            className="shrink-0 mx-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/35 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="مسح باركود / IMEI بالكاميرا"
            aria-label="مسح باركود / IMEI بالكاميرا"
          >
            <ScanLine className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden mt-3">
        {historyLoading ? (
          <p className="p-8 text-center text-muted">جاري تحميل السجل...</p>
        ) : history.length === 0 ? (
          <p className="p-8 text-center text-muted">
            {historySearch.trim() ? "لا توجد نتائج" : "لا يوجد سجل حجوزات منتهية"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-white/10">
                  <ThEmoji emoji={em.product} className="text-right p-4">
                    الجهاز
                  </ThEmoji>
                  <ThEmoji emoji={em.customer} className="text-right p-4">
                    العميل
                  </ThEmoji>
                  <ThEmoji emoji={em.status} className="text-right p-4">
                    الحالة
                  </ThEmoji>
                  <ThEmoji emoji={em.date} className="text-right p-4">
                    تاريخ الإنهاء
                  </ThEmoji>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="p-4">
                        <p className="font-semibold text-white">{phoneTitle(row.serial)}</p>
                        <p className="text-xs text-muted mt-1">{row.serial.imeiLabel}</p>
                      </td>
                      <td className="p-4 text-white">{row.customer.nameAr}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            row.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-500/10 text-red-300 border border-red-500/25"
                          }`}
                        >
                          {historyStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="p-4 text-muted">{historyFinishedAt(row)}</td>
                      <td className="p-4 text-left">
                        <button
                          type="button"
                          onClick={() =>
                            setHistoryExpandedId((current) => (current === row.id ? null : row.id))
                          }
                          className={reservationBtnView}
                        >
                          <span className="text-base leading-none shrink-0">{em.view}</span>
                          {historyExpandedId === row.id ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                        </button>
                      </td>
                    </tr>
                    {historyExpandedId === row.id ? (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={5} className="p-4 text-sm text-muted space-y-2">
                          <p>
                            <span className="text-white font-medium">العميل: </span>
                            {row.customer.nameAr}
                            {row.customer.phone ? ` — ${row.customer.phone}` : ""}
                          </p>
                          <p>
                            <span className="text-white font-medium">تاريخ الحجز: </span>
                            {new Date(row.reservedAt).toLocaleString("ar-EG")}
                          </p>
                          <p>
                            <span className="text-white font-medium">تاريخ الإنهاء: </span>
                            {historyFinishedAt(row)}
                          </p>
                          <p>
                            <span className="text-white font-medium">الحالة: </span>
                            {historyStatusLabel(row.status)}
                          </p>
                          {row.reservedBy ? (
                            <p>
                              <span className="text-white font-medium">بواسطة: </span>
                              {row.reservedBy.nameAr}
                            </p>
                          ) : null}
                          <p>
                            <span className="text-white font-medium">ملاحظات: </span>
                            {row.notes?.trim() || "—"}
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      ) : null}

      <Modal
        open={reserveOpen}
        onClose={() => !saving && setReserveOpen(false)}
        title="حجز جهاز"
        size="md"
      >
        {selectedPhone ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
              <p className="font-bold text-white">{phoneTitle(selectedPhone)}</p>
              <p className="text-xs text-muted mt-1">{selectedPhone.imeiLabel}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-muted inline-flex items-center gap-1.5">
                  <span>{em.customer}</span>
                  العميل
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomerLookup((open) => !open)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base transition-colors ${
                    showCustomerLookup
                      ? "border-primary/50 bg-primary/20 text-primary-light"
                      : "border-white/15 bg-white/5 text-muted hover:border-primary/40 hover:text-primary-light"
                  }`}
                  title="بحث واختيار عميل"
                >
                  {em.search}
                </button>
              </div>

              {showCustomerLookup ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <input
                    ref={customerLookupRef}
                    type="search"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="glass-input w-full text-sm"
                    placeholder="بحث بالاسم أو رقم الهاتف..."
                  />
                  {customerResults.length === 0 ? (
                    <p className="text-xs text-muted px-1 py-2 text-center">
                      {customerSearch.trim() ? "لا توجد نتائج" : "لا يوجد عملاء"}
                    </p>
                  ) : (
                    <ul className="max-h-44 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5 bg-background-card/80">
                      {customerResults.map((customer) => (
                        <li key={customer.id}>
                          <button
                            type="button"
                            onClick={() => pickCustomer(customer)}
                            className="w-full text-right px-3 py-2.5 hover:bg-primary/10 transition-colors"
                          >
                            <p className="text-sm font-medium text-white">{customer.nameAr}</p>
                            {customer.phone ? (
                              <p className="text-xs text-muted mt-0.5" dir="ltr">
                                {customer.phone}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              <div>
                <label className="block text-xs text-muted mb-1.5">اسم العميل</label>
                <input
                  type="text"
                  value={customerName}
                  readOnly
                  placeholder="اختر عميلاً من القائمة 🔍"
                  className="glass-input w-full bg-white/[0.03] cursor-default"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">رقم الهاتف</label>
                <input
                  type="text"
                  value={customerPhone}
                  readOnly
                  placeholder="—"
                  dir="ltr"
                  className="glass-input w-full bg-white/[0.03] text-left cursor-default"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1.5">ملاحظات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="glass-input w-full min-h-[80px]"
                placeholder="اختياري"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitReserve()}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : "تأكيد الحجز"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setReserveOpen(false)}
                className="btn-secondary px-6"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="إلغاء الحجز"
        size="sm"
      >
        {cancelTarget ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 space-y-2">
              <p className="text-sm text-muted leading-relaxed">
                هل تريد إلغاء حجز هذا الجهاز؟ سيعود الجهاز{" "}
                <span className="text-white font-semibold">متاحاً</span> في المخزون.
              </p>
              <div className="pt-2 border-t border-white/10 space-y-1.5 text-sm">
                <p>
                  <span className="text-muted">الجهاز: </span>
                  <span className="text-white font-medium">{phoneTitle(cancelTarget.serial)}</span>
                </p>
                <p>
                  <span className="text-muted">IMEI: </span>
                  <span className="text-primary-light">{cancelTarget.serial.imeiLabel}</span>
                </p>
                <p>
                  <span className="text-muted">العميل: </span>
                  <span className="text-white">{cancelTarget.customer.nameAr}</span>
                  {cancelTarget.customer.phone ? (
                    <span className="text-muted" dir="ltr">
                      {" "}
                      — {cancelTarget.customer.phone}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void confirmCancelReservation()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                <span className="text-base leading-none">{em.delete}</span>
                {cancelling ? "جاري الإلغاء..." : "نعم، إلغاء الحجز"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
