"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import { ActionEmoji, CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface Customer {
  id: string;
  nameAr: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  branches?: { id: string; nameAr: string }[];
}

function formatBranchesLabel(branches: { nameAr: string }[] | undefined) {
  if (!branches?.length) return "—";
  if (branches.length <= 2) return branches.map((b) => b.nameAr).join("، ");
  return `${branches.length} فروع`;
}

function branchesTooltip(branches: { nameAr: string }[] | undefined) {
  if (!branches?.length) return undefined;
  return branches.map((b) => b.nameAr).join("، ");
}

function CustomersPageContent() {
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nameAr: "", phone: "", email: "", address: "" });

  const load = () => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    apiJson<{ customers: Customer[] }>(`/api/customers${q}`).then(({ ok, data }) => {
      if (ok) setCustomers(data.customers || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setForm({ nameAr: "", phone: "", email: "", address: "" });
    setEditId(null);
    setShowForm(true);
  }, [searchParams]);

  const resetForm = () => {
    setForm({ nameAr: "", phone: "", email: "", address: "" });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim() || !form.phone.trim()) return;
    const url = editId ? `/api/customers/${editId}` : "/api/customers";
    const method = editId ? "PUT" : "POST";

    const { ok, data } = await apiJson<{ message?: string }>(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!ok) {
      toast.error(data.message || "تعذّر الحفظ");
      return;
    }

    resetForm();
    load();
  };

  const handleEdit = (c: Customer) => {
    setForm({
      nameAr: c.nameAr,
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
    });
    setEditId(c.id);
    setShowForm(true);
  };

  return (
    <>
      <PageHeader title="العملاء" subtitle="إدارة بيانات العملاء" />

      <div className="mb-4">
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-semibold"
        >
          + عميل جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            required
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            className="glass-input"
            placeholder="اسم العميل *"
          />
          <input
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="glass-input"
            placeholder="الهاتف *"
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="glass-input"
            placeholder="البريد (اختياري)"
          />
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="glass-input"
            placeholder="العنوان (اختياري)"
          />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="btn-primary">
              {editId ? "حفظ التعديل" : "إضافة العميل"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-xl border border-border text-muted">
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="glass-card p-4 mb-5">
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark inline-flex items-center justify-center text-lg leading-none" title="Search">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full bg-background-input border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm text-white"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
              <ThEmoji emoji={em.name} className="text-right p-4 font-medium">
                الاسم
              </ThEmoji>
              <ThEmoji emoji={em.phone} className="text-right p-4 font-medium">
                الهاتف
              </ThEmoji>
              <ThEmoji emoji={em.address} className="text-right p-4 font-medium">
                العنوان
              </ThEmoji>
              <ThEmoji emoji={em.branch} className="text-right p-4 font-medium">
                فروع التعامل
              </ThEmoji>
              <ThEmoji emoji={em.actions} className="text-right p-4 font-medium w-24">
                إجراءات
              </ThEmoji>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  جاري التحميل...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted">
                  لا يوجد عملاء
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                  <td className="p-4 text-sm font-medium text-white">
                    <CellEmoji emoji={em.name}>{c.nameAr}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-muted">
                    <CellEmoji emoji={em.phone}>{c.phone}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-muted-dark truncate max-w-[200px]">
                    <CellEmoji emoji={em.address}>{c.address}</CellEmoji>
                  </td>
                  <td
                    className="p-4 text-sm text-muted max-w-[220px] truncate"
                    title={branchesTooltip(c.branches)}
                  >
                    <CellEmoji emoji={em.branch}>{formatBranchesLabel(c.branches)}</CellEmoji>
                  </td>
                  <td className="p-4">
                    <ActionEmoji
                      emoji={em.edit}
                      title="تعديل"
                      onClick={() => handleEdit(c)}
                      className="text-muted hover:text-white hover:border-primary/30"
                    />
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

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card p-12 text-center text-muted animate-pulse">جاري التحميل...</div>
      }
    >
      <CustomersPageContent />
    </Suspense>
  );
}
