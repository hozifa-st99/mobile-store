"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import { ActionEmoji, CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface BranchEmployee {
  id: string;
  employeeCode: string;
  nameAr: string;
  phone?: string | null;
  address?: string | null;
}

const emptyForm = { nameAr: "", phone: "", address: "" };

function SummaryCard({
  emoji,
  label,
  value,
  borderClass,
  bgClass,
  valueClass = "text-white",
}: {
  emoji: string;
  label: string;
  value: string | number;
  borderClass: string;
  bgClass: string;
  valueClass?: string;
}) {
  return (
    <div className={`glass-card p-4 border ${borderClass} ${bgClass}`}>
      <p className="text-xs text-muted mb-1 inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function BranchEmployeesPageContent() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [employees, setEmployees] = useState<BranchEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}&activeOnly=false` : "?activeOnly=false";
    apiJson<{ employees: BranchEmployee[] }>(`/api/branch-employees${q}`).then(({ ok, data }) => {
      if (ok) setEmployees(data.employees || []);
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
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
  };

  const handleEdit = (emp: BranchEmployee) => {
    setForm({
      nameAr: emp.nameAr,
      phone: emp.phone || "",
      address: emp.address || "",
    });
    setEditId(emp.id);
    setShowForm(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim()) {
      toast.error("اسم الموظف مطلوب");
      return;
    }

    setSaving(true);
    const url = editId ? `/api/branch-employees/${editId}` : "/api/branch-employees";
    const method = editId ? "PUT" : "POST";
    const { ok, data, status } = await apiJson<{ message?: string; employee?: BranchEmployee }>(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);

    if (!ok) {
      toast.error(
        status === 401
          ? "انتهت الجلسة — سجّل الدخول مرة أخرى"
          : data.message || "تعذّر حفظ بيانات الموظف"
      );
      return;
    }

    toast.success(editId ? "تم تحديث بيانات الموظف" : "تم إضافة الموظف بنجاح");
    resetForm();
    load();
  };

  return (
    <>
      <PageHeader title="الموظفين" subtitle="إدارة موظفي الفرع — للمكافآت وتتبع المبيعات" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <SummaryCard
          emoji="👔"
          label="إجمالي الموظفين"
          value={loading ? "…" : employees.length}
          borderClass="border-primary/25"
          bgClass="bg-primary/5"
        />
      </div>

      <div className="glass-card p-3 mb-5 flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-glow-sm hover:brightness-110 transition-all shrink-0"
        >
          <span className="text-base leading-none">➕</span>
          موظف جديد
        </button>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden>
            {em.search}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input h-12 py-0 pr-10 w-full text-sm"
            placeholder="بحث بالاسم أو الهاتف أو الرقم..."
          />
        </div>
      </div>

      {showForm && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="glass-card p-5 mb-5 border border-primary/20 shadow-glow-sm"
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
            <span className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-lg">
              {editId ? em.edit : em.add}
            </span>
            <div>
              <p className="text-sm font-bold text-white">{editId ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</p>
              <p className="text-xs text-muted">الحقول بعلامة * مطلوبة</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              className="glass-input"
              placeholder="اسم الموظف *"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="glass-input"
              placeholder="رقم الهاتف"
              dir="ltr"
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="glass-input sm:col-span-2"
              placeholder="العنوان"
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/60">
            <button type="submit" disabled={saving} className="btn-primary sm:w-auto min-w-[160px]">
              {saving ? "جاري الحفظ..." : editId ? "حفظ التعديل" : "إضافة الموظف"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="h-12 px-6 rounded-xl border border-border text-muted hover:text-white hover:border-primary/30 transition-colors sm:w-auto"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
              <ThEmoji emoji={em.number} className="text-right p-4 font-medium w-24">
                الرقم
              </ThEmoji>
              <ThEmoji emoji={em.customer} className="text-right p-4 font-medium">
                الاسم
              </ThEmoji>
              <ThEmoji emoji={em.phone} className="text-center p-4 font-medium">
                الهاتف
              </ThEmoji>
              <ThEmoji emoji={em.address} className="text-right p-4 font-medium">
                العنوان
              </ThEmoji>
              <ThEmoji emoji={em.actions} className="text-right p-4 font-medium w-24">
                إجراءات
              </ThEmoji>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted">
                  جاري التحميل...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted">
                  لا يوجد موظفين — أضف موظفاً للبدء
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border/40 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 text-sm font-mono font-bold text-primary-light">{emp.employeeCode}</td>
                  <td className="p-4 text-sm font-medium text-white">
                    <CellEmoji emoji={em.customer}>{emp.nameAr}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-muted text-center">
                    <span className="inline-flex items-center justify-center gap-1.5" dir="ltr">
                      {emp.phone ? (
                        <>
                          <span aria-hidden className="opacity-85">{em.phone}</span>
                          <span>{emp.phone}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-dark truncate max-w-[240px]">
                    <CellEmoji emoji={em.address}>{emp.address}</CellEmoji>
                  </td>
                  <td className="p-4">
                    <ActionEmoji
                      emoji={em.edit}
                      title="تعديل"
                      onClick={() => handleEdit(emp)}
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

export default function BranchEmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-card p-12 text-center text-muted animate-pulse">جاري التحميل...</div>
      }
    >
      <BranchEmployeesPageContent />
    </Suspense>
  );
}
