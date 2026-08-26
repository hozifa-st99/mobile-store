"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/layout/PageHeader";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useScreenAccess } from "@/hooks/use-screen-access";

interface BranchRow {
  id: string;
  nameAr: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  hasActivity: boolean;
  codeLocked: boolean;
}

const emptyForm = {
  nameAr: "",
  code: "",
  address: "",
  phone: "",
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "primary" | "warning" | "danger";
  onConfirm: () => void | Promise<void>;
};

export default function BranchesSettingsPage() {
  const { canAccessPath } = useScreenAccess();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editBranch, setEditBranch] = useState<BranchRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiJson<{ branches: BranchRow[]; message?: string }>(
      "/api/branches?includeInactive=1"
    );
    if (!ok) {
      toast.error((data.message as string) || "تعذر تحميل الفروع");
      setLoading(false);
      return;
    }
    setBranches(data.branches || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!canAccessPath("/dashboard/settings/branches")) return;
    load();
  }, [load, canAccessPath]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim() || !form.code.trim()) return;
    setSaving(true);
    const { ok, data } = await apiJson<{ message?: string }>("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr: form.nameAr.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      }),
    });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "تعذر إضافة الفرع");
      return;
    }
    toast.success("تم إضافة الفرع");
    setForm(emptyForm);
    load();
  };

  const openEdit = (branch: BranchRow) => {
    setEditBranch(branch);
    setEditForm({
      nameAr: branch.nameAr,
      code: branch.code || "",
      address: branch.address || "",
      phone: branch.phone || "",
    });
  };

  const handleEditSave = async () => {
    if (!editBranch || !editForm.nameAr.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      nameAr: editForm.nameAr.trim(),
      address: editForm.address.trim() || null,
      phone: editForm.phone.trim() || null,
    };
    if (!editBranch.codeLocked && editForm.code.trim()) {
      payload.code = editForm.code.trim().toUpperCase();
    }
    const { ok, data } = await apiJson<{ message?: string }>(`/api/branches/${editBranch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "تعذر تحديث الفرع");
      return;
    }
    toast.success("تم تحديث الفرع");
    setEditBranch(null);
    load();
  };

  const applyToggleActive = async (branch: BranchRow, nextActive: boolean) => {
    const label = nextActive ? "تفعيل" : "إيقاف";
    setSaving(true);
    const { ok, data } = await apiJson<{ message?: string }>(`/api/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextActive }),
    });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || `تعذر ${label} الفرع`);
      return;
    }
    toast.success(nextActive ? "تم تفعيل الفرع" : "تم إيقاف الفرع");
    load();
  };

  const askToggleActive = (branch: BranchRow) => {
    const nextActive = !branch.isActive;
    if (nextActive) {
      setConfirmModal({
        title: "تفعيل الفرع",
        message: `هل تريد تفعيل فرع «${branch.nameAr}»؟ سيظهر مرة أخرى في اختيار الفروع.`,
        confirmLabel: "تفعيل",
        tone: "primary",
        onConfirm: () => applyToggleActive(branch, true),
      });
      return;
    }
    setConfirmModal({
      title: "إيقاف الفرع",
      message: `هل تريد إيقاف فرع «${branch.nameAr}»؟ الفواتير والمخزون يفضلون محفوظين، لكن الفرع لن يظهر في الاختيار.`,
      confirmLabel: "إيقاف الفرع",
      tone: "warning",
      onConfirm: () => applyToggleActive(branch, false),
    });
  };

  const runConfirm = async () => {
    if (!confirmModal) return;
    setConfirmLoading(true);
    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  if (!canAccessPath("/dashboard/settings/branches")) {
    return (
      <div className="glass-card p-8 text-center text-muted">
        ليس لديك صلاحية الوصول إلى هذه الشاشة.
      </div>
    );
  }

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

      <PageHeader
        title="الفروع"
        subtitle="إضافة وتعديل فروع المحل — كل فرع له مخزون وفواتير منفصلة"
      />

      <form onSubmit={handleAdd} className="glass-card p-5 mb-5 space-y-3">
        <p className="text-sm text-muted">إضافة فرع جديد</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            required
            value={form.nameAr}
            onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            className="glass-input"
            placeholder="اسم الفرع *"
          />
          <input
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="glass-input uppercase"
            placeholder="كود الفرع * (مثل MAD)"
            maxLength={6}
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="glass-input"
            placeholder="الهاتف"
          />
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="glass-input sm:col-span-2 lg:col-span-1"
            placeholder="العنوان"
          />
        </div>
        <p className="text-xs text-muted">
          الكود يظهر في الفواتير: SAL-<strong>XXX</strong>-00000001 — لا يُغيّر بعد أول فاتورة.
        </p>
        <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2">
          {em.add} إضافة فرع
        </button>
      </form>

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
              <ThEmoji emoji={em.branch} className="text-right p-4 font-medium">
                الفرع
              </ThEmoji>
              <th className="text-right p-4 font-medium">الكود</th>
              <ThEmoji emoji={em.phone} className="text-right p-4 font-medium">
                التواصل
              </ThEmoji>
              <th className="text-right p-4 font-medium">الحالة</th>
              <th className="text-right p-4 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted animate-pulse">
                  جاري التحميل...
                </td>
              </tr>
            ) : branches.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted">
                  لا يوجد فروع
                </td>
              </tr>
            ) : (
              branches.map((branch) => (
                <tr
                  key={branch.id}
                  className={cn(
                    "border-b border-border/40 hover:bg-white/[0.02]",
                    !branch.isActive && "opacity-60"
                  )}
                >
                  <td className="p-4 text-sm font-semibold text-white">
                    <CellEmoji emoji={em.branch}>{branch.nameAr}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm font-mono text-primary-light">{branch.code || "—"}</td>
                  <td className="p-4 text-sm text-muted">
                    <div>{branch.phone || "—"}</div>
                    {branch.address && (
                      <div className="text-xs text-muted-dark mt-0.5 truncate max-w-[200px]">
                        {branch.address}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        branch.isActive
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/10 text-muted"
                      )}
                    >
                      {branch.isActive ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(branch)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => askToggleActive(branch)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white"
                      >
                        {branch.isActive ? "إيقاف" : "تفعيل"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editBranch} onClose={() => setEditBranch(null)} title="تعديل الفرع">
        {editBranch && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted mb-1 block">اسم الفرع</label>
              <input
                value={editForm.nameAr}
                onChange={(e) => setEditForm({ ...editForm, nameAr: e.target.value })}
                className="glass-input w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">كود الفرع</label>
              <input
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                className="glass-input w-full uppercase"
                disabled={editBranch.codeLocked}
                maxLength={6}
              />
              {editBranch.codeLocked && (
                <p className="text-xs text-amber-400/90 mt-1">
                  الكود مقفول — يوجد فواتير أو مخزون على هذا الفرع.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">الهاتف</label>
              <input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="glass-input w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">العنوان</label>
              <input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="glass-input w-full"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditBranch(null)} className="btn-secondary flex-1">
                إلغاء
              </button>
              <button type="button" onClick={handleEditSave} disabled={saving} className="btn-primary flex-1">
                حفظ
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmModal !== null}
        onClose={() => !confirmLoading && setConfirmModal(null)}
        title={confirmModal?.title || "تأكيد"}
        size="sm"
      >
        {confirmModal && (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                disabled={confirmLoading}
                onClick={() => setConfirmModal(null)}
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={confirmLoading || saving}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                  confirmModal.tone === "danger" &&
                    "border border-red-500/30 text-red-200 hover:bg-red-500/10",
                  confirmModal.tone === "warning" &&
                    "border border-amber-500/30 text-amber-200 hover:bg-amber-500/10",
                  confirmModal.tone === "primary" && "btn-primary"
                )}
                onClick={() => void runConfirm()}
              >
                {confirmLoading ? "جاري التنفيذ..." : confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
