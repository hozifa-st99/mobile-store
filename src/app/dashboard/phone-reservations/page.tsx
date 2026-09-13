"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  notes: string | null;
  reservedAt: string;
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

export default function PhoneReservationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("available");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [phones, setPhones] = useState<AvailablePhone[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [reserveOpen, setReserveOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<AvailablePhone | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => {
    if (!reserveOpen) {
      setCustomerResults([]);
      return;
    }
    const q = customerSearch.trim();
    if (q.length < 1) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void apiJson<{ customers?: CustomerOption[] }>(
        `/api/customers?search=${encodeURIComponent(q)}`
      ).then(({ data }) => setCustomerResults(data.customers || []));
    }, 280);
    return () => clearTimeout(timer);
  }, [customerSearch, reserveOpen]);

  const openReserve = (phone: AvailablePhone) => {
    setSelectedPhone(phone);
    setSelectedCustomerId("");
    setCustomerSearch("");
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

  const cancelReservation = async (id: string) => {
    if (!confirm("إلغاء الحجز؟")) return;
    const { ok, data } = await apiJson<{ message?: string }>(`/api/phone-reservations/${id}`, {
      method: "DELETE",
    });
    if (!ok) {
      toast.error(data.message || "تعذّر الإلغاء");
      return;
    }
    toast.success("تم إلغاء الحجز");
    void load();
  };

  const completeSale = (id: string) => {
    router.push(`/dashboard/sales/new?reservationId=${encodeURIComponent(id)}`);
  };

  return (
    <>
      <PageHeader
        title="حجز هاتف"
        subtitle="حجز موبايلات الفرع — المحجوز لا يظهر «متاح» في استعلام الفروع الأخرى"
        showHomeButton
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

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث: اسم الموبايل · IMEI · باركود"
          className="glass-input w-full"
        />
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
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((current) => (current === row.id ? null : row.id))
                            }
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            {expandedId === row.id ? "إخفاء" : "عرض التفاصيل"}
                          </button>
                          <button
                            type="button"
                            onClick={() => completeSale(row.id)}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            إكمال البيع
                          </button>
                          <button
                            type="button"
                            onClick={() => void cancelReservation(row.id)}
                            className="btn-secondary text-xs px-3 py-1.5 text-accent-orange"
                          >
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

            <div>
              <label className="block text-xs text-muted mb-1.5">بحث عن العميل</label>
              <input
                type="search"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="glass-input w-full"
                placeholder="اسم أو رقم هاتف"
              />
              {customerResults.length > 0 ? (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                  {customerResults.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`w-full text-right px-3 py-2 text-sm hover:bg-white/5 ${
                          selectedCustomerId === customer.id ? "bg-primary/15 text-primary-light" : ""
                        }`}
                      >
                        {customer.nameAr}
                        {customer.phone ? ` — ${customer.phone}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
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
    </>
  );
}
