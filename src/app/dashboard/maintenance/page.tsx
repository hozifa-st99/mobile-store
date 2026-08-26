"use client";

import { useEffect, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: string;
  deviceBrand: string;
  deviceModel?: string;
  issue: string;
  status: string;
  cost: number;
  receivedDate: string;
  customer?: { nameAr: string } | null;
}

interface Customer {
  id: string;
  nameAr: string;
}

const statusMap: Record<string, { label: string; class: string }> = {
  pending: { label: "قيد الانتظار", class: "status-pending" },
  in_progress: { label: "جاري العمل", class: "px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20" },
  ready: { label: "جاهز", class: "status-complete" },
  delivered: { label: "تم التسليم", class: "px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" },
  cancelled: { label: "ملغي", class: "px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20" },
};

export default function MaintenancePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    customerId: "",
    deviceBrand: "",
    deviceModel: "",
    imei: "",
    issue: "",
    cost: "",
  });

  const load = () => {
    fetch("/api/maintenance", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    fetch("/api/customers", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/maintenance", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cost: Number(form.cost) || 0,
        customerId: form.customerId || null,
      }),
    });
    setForm({ customerId: "", deviceBrand: "", deviceModel: "", imei: "", issue: "", cost: "" });
    setShowForm(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/maintenance/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  return (
    <>
      <PageHeader title="الصيانة" subtitle="طلبات صيانة الأجهزة" />

      <div className="mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-semibold"
        >
          <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="Plus">➕</span> طلب صيانة جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="glass-card p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            className="glass-input"
          >
            <option value="">بدون عميل</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameAr}
              </option>
            ))}
          </select>
          <input
            required
            value={form.deviceBrand}
            onChange={(e) => setForm({ ...form, deviceBrand: e.target.value })}
            className="glass-input"
            placeholder="ماركة الجهاز *"
          />
          <input
            value={form.deviceModel}
            onChange={(e) => setForm({ ...form, deviceModel: e.target.value })}
            className="glass-input"
            placeholder="الموديل"
          />
          <input
            value={form.imei}
            onChange={(e) => setForm({ ...form, imei: e.target.value })}
            className="glass-input"
            placeholder="IMEI"
          />
          <input
            required
            value={form.issue}
            onChange={(e) => setForm({ ...form, issue: e.target.value })}
            className="glass-input sm:col-span-2"
            placeholder="وصف العطل *"
          />
          <input
            type="number"
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            className="glass-input"
            placeholder="التكلفة المتوقعة"
          />
          <button type="submit" className="btn-primary">
            حفظ الطلب
          </button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
              <ThEmoji emoji={em.order} className="text-right p-4 font-medium">
                رقم الطلب
              </ThEmoji>
              <ThEmoji emoji={em.device} className="text-right p-4 font-medium">
                الجهاز
              </ThEmoji>
              <ThEmoji emoji={em.issue} className="text-right p-4 font-medium">
                العطل
              </ThEmoji>
              <ThEmoji emoji={em.customer} className="text-right p-4 font-medium">
                العميل
              </ThEmoji>
              <ThEmoji emoji={em.cost} className="text-right p-4 font-medium">
                التكلفة
              </ThEmoji>
              <ThEmoji emoji={em.status} className="text-right p-4 font-medium">
                الحالة
              </ThEmoji>
              <ThEmoji emoji={em.actions} className="text-right p-4 font-medium">
                إجراء
              </ThEmoji>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  جاري التحميل...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-muted">
                  لا توجد طلبات صيانة
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                  <td className="p-4 text-sm font-semibold text-primary-light">
                    <CellEmoji emoji={em.order}>{o.orderNumber}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-white">
                    <CellEmoji emoji={em.device}>
                      {o.deviceBrand} {o.deviceModel || ""}
                    </CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-muted max-w-[180px] truncate">
                    <CellEmoji emoji={em.issue}>{o.issue}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-muted">
                    <CellEmoji emoji={em.customer}>{o.customer?.nameAr}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-white">
                    <CellEmoji emoji={em.cost}>{formatCurrency(o.cost)} ج.م</CellEmoji>
                  </td>
                  <td className="p-4">
                    <span className={statusMap[o.status]?.class || "status-pending"}>
                      {statusMap[o.status]?.label || o.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      value={o.status}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className="bg-background-input border border-border rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="in_progress">جاري العمل</option>
                      <option value="ready">جاهز</option>
                      <option value="delivered">تم التسليم</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
