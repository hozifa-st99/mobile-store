"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import { em } from "@/components/ui/TableEmoji";
import { type ExpenseCategoryItem } from "@/lib/expense-categories";
import { toast } from "@/lib/toast";

async function apiPut(body: Record<string, unknown>) {
  const res = await fetch("/api/settings/expense-categories", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export default function ExpenseCategoriesSettingsPage() {
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/expense-categories", { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data.categories)) setCategories(data.categories);
    } catch {
      toast.error("تعذر تحميل القائمة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setNameInput("");
    setEditKey(null);
    setModal("add");
  };

  const openEdit = (item: ExpenseCategoryItem) => {
    setEditKey(item.key);
    setNameInput(item.nameAr);
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditKey(null);
    setNameInput("");
  };

  const handleSaveModal = async () => {
    const nameAr = nameInput.trim();
    if (!nameAr) {
      toast.error("أدخل اسم التصنيف");
      return;
    }
    setSaving(true);
    const { ok, data } = await apiPut(
      modal === "add"
        ? { action: "create", nameAr }
        : { action: "update", key: editKey, nameAr }
    );
    setSaving(false);
    if (!ok) {
      toast.error(data.message || "فشل الحفظ");
      return;
    }
    if (Array.isArray(data.categories)) setCategories(data.categories);
    toast.success(modal === "add" ? "تمت الإضافة" : "تم التعديل");
    closeModal();
  };

  const handleDelete = async (item: ExpenseCategoryItem) => {
    if (item.isSystem) {
      toast.error("تصنيف النظام — لا يمكن حذفه");
      return;
    }
    if (!window.confirm(`حذف تصنيف «${item.nameAr}»؟`)) return;
    setSaving(true);
    const { ok, data } = await apiPut({ action: "delete", key: item.key });
    setSaving(false);
    if (!ok) {
      toast.error(data.message || "تعذر الحذف");
      return;
    }
    if (Array.isArray(data.categories)) setCategories(data.categories);
    toast.success("تم الحذف");
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <span aria-hidden>➡️</span> رجوع للإعدادات
        </Link>
      </div>

      <PageHeader
        title="قائمة المصروفات"
        subtitle="تصنيفات المصروفات — تظهر عند تسجيل المصروف وفي التقارير"
      />

      <div className="glass-card p-5 max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/40 mb-4">
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2">
            <span>{em.payment}</span>
            التصنيفات
          </h2>
          <button type="button" onClick={openAdd} className="btn-primary text-sm inline-flex items-center gap-2">
            <span>{em.add}</span>
            إضافة تصنيف
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted animate-pulse">جاري التحميل...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted">لا توجد تصنيفات.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((item) => (
              <li
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-3 py-3 px-3 rounded-xl border border-border/50 bg-background/30"
              >
                <div>
                  <p className="text-sm font-medium text-white">{item.nameAr}</p>
                  {item.isSystem ? (
                    <p className="text-xs text-muted mt-0.5">تصنيف نظام — لا يُحذف</p>
                  ) : (
                    <p className="text-xs text-muted-dark mt-0.5 font-mono" dir="ltr">
                      {item.key}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    disabled={saving}
                    className="text-sm px-3 py-1.5 rounded-lg border border-border text-muted hover:text-white"
                  >
                    تعديل
                  </button>
                  {!item.isSystem ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      disabled={saving}
                      className="text-sm px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10"
                    >
                      حذف
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={modal !== null} onClose={closeModal} title={modal === "add" ? "إضافة تصنيف" : "تعديل التصنيف"}>
        <label className="text-sm text-muted block mb-2">اسم التصنيف (عربي)</label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="glass-input w-full mb-4"
          placeholder="مثال: صيانة"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={closeModal} className="btn-secondary text-sm">
            إلغاء
          </button>
          <button type="button" onClick={() => void handleSaveModal()} disabled={saving} className="btn-primary text-sm">
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </Modal>
    </>
  );
}