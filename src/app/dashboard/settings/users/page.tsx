"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { APP_SCREENS, ROLES, SCREEN_KEYS, type ScreenKey } from "@/lib/permissions";
import { useScreenAccess } from "@/hooks/use-screen-access";

interface UserRow {
  id: string;
  username: string;
  fullNameAr: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  roleLabel: string;
  isActive: boolean;
  branches: string[];
  branchIds: string[];
  screenPermissions: Array<{ screenKey: string; allowed: boolean }>;
}

interface BranchOption {
  id: string;
  name: string;
}

type FormState = {
  username: string;
  password: string;
  fullNameAr: string;
  email: string;
  phone: string;
  role: typeof ROLES.ADMIN | typeof ROLES.EMPLOYEE;
  branchIds: string[];
  screenPermissions: Record<ScreenKey, boolean>;
};

const emptyPermissions = () =>
  SCREEN_KEYS.reduce(
    (acc, key) => {
      acc[key] = false;
      return acc;
    },
    {} as Record<ScreenKey, boolean>
  );

const fieldClass =
  "w-full rounded-xl border border-border bg-background-input px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50";
const labelClass = "block text-sm text-muted mb-1.5";

const emptyForm = (): FormState => ({
  username: "",
  password: "",
  fullNameAr: "",
  email: "",
  phone: "",
  role: ROLES.EMPLOYEE,
  branchIds: [],
  screenPermissions: emptyPermissions(),
});

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "primary" | "warning" | "danger";
  onConfirm: () => void | Promise<void>;
};

export default function UsersSettingsPage() {
  const { canAccessPath } = useScreenAccess();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const screens = useMemo(() => APP_SCREENS, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, branchesRes] = await Promise.all([
        fetch("/api/users", { credentials: "include" }),
        fetch("/api/branches/list", { credentials: "include" }),
      ]);
      const usersData = await usersRes.json();
      const branchesData = await branchesRes.json();
      if (!usersRes.ok) throw new Error(usersData.message || "تعذر تحميل المستخدمين");
      setUsers(usersData.users || []);
      setBranches(branchesData.branches || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessPath("/dashboard/settings/users")) return;
    loadData();
  }, [canAccessPath]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (user: UserRow) => {
    const perms = emptyPermissions();
    for (const p of user.screenPermissions) {
      if (p.allowed && p.screenKey in perms) {
        perms[p.screenKey as ScreenKey] = true;
      }
    }
    setEditing(user);
    setForm({
      username: user.username,
      password: "",
      fullNameAr: user.fullNameAr,
      email: user.email || "",
      phone: user.phone || "",
      role: user.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.EMPLOYEE,
      branchIds: user.branchIds,
      screenPermissions: perms,
    });
    setModalOpen(true);
  };

  const askEdit = (user: UserRow) => {
    setConfirmModal({
      title: "تأكيد فتح التعديل",
      message: `هل تريد تعديل بيانات حساب «${user.fullNameAr}»؟`,
      confirmLabel: "متابعة التعديل",
      tone: "primary",
      onConfirm: async () => {
        openEdit(user);
      },
    });
  };

  const toggleScreen = (key: ScreenKey) => {
    setForm((prev) => ({
      ...prev,
      screenPermissions: {
        ...prev.screenPermissions,
        [key]: !prev.screenPermissions[key],
      },
    }));
  };

  const toggleBranch = (branchId: string) => {
    setForm((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter((id) => id !== branchId)
        : [...prev.branchIds, branchId],
    }));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        fullNameAr: form.fullNameAr,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role,
        branchIds: form.role === ROLES.ADMIN ? [] : form.branchIds,
        screenPermissions: SCREEN_KEYS.map((screenKey) => ({
          screenKey,
          allowed: form.role === ROLES.ADMIN ? true : form.screenPermissions[screenKey],
        })),
        ...(form.password ? { password: form.password } : {}),
        ...(editing ? { isActive: editing.isActive } : {}),
        ...(editing ? {} : { username: form.username, password: form.password }),
      };

      const res = await fetch(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "تعذر حفظ المستخدم");

      toast.success(editing ? "تم تحديث المستخدم" : "تم إضافة المستخدم");
      setModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المستخدم");
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    void handleSave();
  };

  const performDeactivate = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "تعذر تعطيل المستخدم");
    toast.success("تم تعطيل المستخدم");
    await loadData();
  };

  const performActivate = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "تعذر تفعيل المستخدم");
    toast.success("تم تفعيل المستخدم");
    await loadData();
  };

  const performDelete = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "تعذر حذف المستخدم");
    toast.success("تم حذف المستخدم");
    await loadData();
  };

  const askDeactivate = (user: UserRow) => {
    setConfirmModal({
      title: "تأكيد التعطيل",
      message: `سيتم تعطيل حساب «${user.fullNameAr}» ولن يتمكن من تسجيل الدخول، مع بقاء الحساب ظاهراً في القائمة.`,
      confirmLabel: "تعطيل الحساب",
      tone: "warning",
      onConfirm: async () => {
        try {
          await performDeactivate(user);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "تعذر تعطيل المستخدم");
          throw error;
        }
      },
    });
  };

  const askActivate = (user: UserRow) => {
    setConfirmModal({
      title: "تأكيد التفعيل",
      message: `هل تريد إعادة تفعيل حساب «${user.fullNameAr}»؟`,
      confirmLabel: "تفعيل الحساب",
      tone: "primary",
      onConfirm: async () => {
        try {
          await performActivate(user);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "تعذر تفعيل المستخدم");
          throw error;
        }
      },
    });
  };

  const askDelete = (user: UserRow) => {
    setConfirmModal({
      title: "تأكيد الحذف",
      message: `سيتم حذف حساب «${user.fullNameAr}» نهائياً من النظام. لا يمكن التراجع عن هذه العملية.`,
      confirmLabel: "حذف نهائي",
      tone: "danger",
      onConfirm: async () => {
        try {
          await performDelete(user);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "تعذر حذف المستخدم");
          throw error;
        }
      },
    });
  };

  if (!canAccessPath("/dashboard/settings/users")) {
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
          </span>
          رجوع للإعدادات
        </Link>
      </div>

      <PageHeader
        title="المستخدمين"
        subtitle="إدارة حسابات الموظفين والصلاحيات"
        extraAction={
          <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={openCreate}>
            + إضافة مستخدم
          </button>
        }
      />

      <div className="glass-card overflow-hidden">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
              <ThEmoji emoji={em.name} className="text-right p-4 font-medium">
                الاسم
              </ThEmoji>
              <ThEmoji emoji={em.username} className="text-right p-4 font-medium">
                اسم المستخدم
              </ThEmoji>
              <ThEmoji emoji={em.role} className="text-right p-4 font-medium">
                الصلاحية
              </ThEmoji>
              <ThEmoji emoji={em.branch} className="text-right p-4 font-medium">
                الفروع
              </ThEmoji>
              <th className="text-right p-4 font-medium">الحالة</th>
              <th className="p-4 text-left font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  جاري التحميل...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  لا يوجد مستخدمون
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    "border-b border-border/40 hover:bg-white/[0.02]",
                    !u.isActive && "opacity-70 bg-white/[0.02]"
                  )}
                >
                  <td className="p-4 text-sm font-medium text-white">
                    <CellEmoji emoji={em.name}>{u.fullNameAr}</CellEmoji>
                  </td>
                  <td className="p-4 text-sm text-primary-light">
                    <CellEmoji emoji={em.username}>{u.username}</CellEmoji>
                  </td>
                  <td className="p-4">
                    <span className="status-complete">{u.roleLabel}</span>
                  </td>
                  <td className="p-4 text-sm text-muted">
                    <CellEmoji emoji={em.branch}>
                      {u.role === ROLES.ADMIN ? "كل الفروع" : u.branches.join(" · ") || "—"}
                    </CellEmoji>
                  </td>
                  <td className="p-4">
                    <span
                      className={cn(
                        "inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold",
                        u.isActive
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      )}
                    >
                      {u.isActive ? "نشط" : "معطّل"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => askEdit(u)}>
                        تعديل
                      </button>
                      {u.isActive ? (
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                          onClick={() => askDeactivate(u)}
                        >
                          تعطيل
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs rounded-lg border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => askActivate(u)}
                        >
                          تفعيل
                        </button>
                      )}
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                        onClick={() => askDelete(u)}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {editing ? "تعديل مستخدم" : "إضافة مستخدم"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!editing && (
                <div>
                  <label className={labelClass}>اسم المستخدم</label>
                  <input
                    className={fieldClass}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>الاسم</label>
                <input
                  className={fieldClass}
                  value={form.fullNameAr}
                  onChange={(e) => setForm({ ...form, fullNameAr: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{editing ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}</label>
                <input
                  type="password"
                  className={fieldClass}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>الدور</label>
                <select
                  className={fieldClass}
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as typeof ROLES.ADMIN | typeof ROLES.EMPLOYEE,
                    })
                  }
                >
                  <option value={ROLES.ADMIN}>أدمن</option>
                  <option value={ROLES.EMPLOYEE}>موظف — صلاحيات مخصصة</option>
                </select>
              </div>
            </div>

            {form.role === ROLES.EMPLOYEE && (
              <>
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-white mb-3">الفروع المسموحة</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {branches.map((branch) => (
                      <label
                        key={branch.id}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.branchIds.includes(branch.id)}
                          onChange={() => toggleBranch(branch.id)}
                        />
                        {branch.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-white mb-3">صلاحيات الشاشات (فتح / غلق)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {screens.map((screen) => (
                      <label
                        key={screen.key}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span>{screen.label}</span>
                        <button
                          type="button"
                          className={
                            form.screenPermissions[screen.key]
                              ? "px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs"
                              : "px-3 py-1 rounded-md bg-red-500/10 text-red-300 text-xs"
                          }
                          onClick={() => toggleScreen(screen.key)}
                        >
                          {form.screenPermissions[screen.key] ? "مفتوح" : "مقفول"}
                        </button>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" className="btn-secondary px-4 py-2" onClick={() => setModalOpen(false)}>
                إلغاء
              </button>
              <button type="button" className="btn-primary px-4 py-2" disabled={saving} onClick={requestSave}>
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                disabled={confirmLoading}
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
