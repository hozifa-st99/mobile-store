"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import { ActionEmoji, CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface Supplier {
  id: string;
  nameAr: string;
  phone?: string;
  email?: string;
  address?: string;
  branches?: { id: string; nameAr: string }[];
}

const emptyForm = {
  nameAr: "",
  phone: "",
  email: "",
  address: "",
};

function formatBranchesLabel(branches: { nameAr: string }[] | undefined) {
  if (!branches?.length) return "—";
  if (branches.length <= 2) return branches.map((b) => b.nameAr).join("، ");
  return `${branches.length} فروع`;
}

function branchesTooltip(branches: { nameAr: string }[] | undefined) {
  if (!branches?.length) return undefined;
  return branches.map((b) => b.nameAr).join("، ");
}

function SuppliersSettingsPageContent() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ kind: "wholesale" });
    if (search) params.set("search", search);
    apiJson<{ suppliers: Supplier[] }>(`/api/suppliers?${params}`).then(({ ok, data }) => {
      if (ok) setSuppliers(data.suppliers || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, 150);
  }, [searchParams]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim() || !form.phone.trim()) return;

    const url = editId ? `/api/suppliers/${editId}` : "/api/suppliers";
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

  const handleEdit = (supplier: Supplier) => {
    setForm({
      nameAr: supplier.nameAr,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
    setEditId(supplier.id);
    setShowForm(true);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="ArrowRight">
            ➡️
          </span>{" "}
          رجوع للإعدادات
        </Link>
      </div>
      <PageHeader title="الموردين" subtitle="إدارة قائمة الموردين" />

      <div className="mb-4">
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-semibold"
        >
          <span aria-hidden>{em.add}</span>
          مورد جديد
        </button>
      </div>

      {showForm ? (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="glass-card p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <input
          required
          value={form.nameAr}
          onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
          className="glass-input"
          placeholder="اسم المورد *"
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
          <button type="submit" className="btn-primary flex items-center justify-center gap-2">
            {!editId && (
              <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="Plus">
                {em.add}
              </span>
            )}
            {editId ? "حفظ التعديل" : "إضافة المورد"}
          </button>
          <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2">
            إلغاء
          </button>
        </div>
      </form>
      ) : null}

      <div className="glass-card p-4 mb-5">
        <div className="relative">
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark inline-flex items-center justify-center text-lg leading-none"
            title="Search"
          >
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full bg-background-input border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm text-white"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
              <ThEmoji emoji={em.supplier} className="text-right p-4 font-medium">
                اسم المورد
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
                <td colSpan={5} className="p-12 text-center text-muted animate-pulse">
                  جاري التحميل...
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted">
                  {search.trim() ? "لا توجد نتائج للبحث" : "لا يوجد موردين — أضف أول مورد"}
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                  <td className="p-4 text-sm font-semibold text-white">
                    <CellEmoji emoji={em.supplier}>{s.nameAr}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-muted">
                    <CellEmoji emoji={em.phone}>{s.phone || "—"}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-muted-dark truncate max-w-[200px]">
                    <CellEmoji emoji={em.address}>{s.address || "—"}</CellEmoji>
                  </td>
                  <td
                    className="p-4 text-sm text-muted max-w-[220px] truncate"
                    title={branchesTooltip(s.branches)}
                  >
                    <CellEmoji emoji={em.branch}>{formatBranchesLabel(s.branches)}</CellEmoji>
                  </td>
                  <td className="p-4">
                    <ActionEmoji
                      emoji={em.edit}
                      title="تعديل"
                      onClick={() => handleEdit(s)}
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

export default function SuppliersSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card p-12 text-center text-muted animate-pulse">جاري التحميل...</div>
      }
    >
      <SuppliersSettingsPageContent />
    </Suspense>
  );
}
