"use client";

import { useEffect, useRef, useState } from "react";

import Modal from "@/components/ui/Modal";
import { em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type QuickAddKind = "supplier" | "customer";

interface CreatedParty {
  id: string;
  nameAr: string;
}

interface PartyForm {
  nameAr: string;
  phone: string;
  email: string;
  address: string;
}

const emptyForm: PartyForm = {
  nameAr: "",
  phone: "",
  email: "",
  address: "",
};

interface PurchaseCounterpartyQuickAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSupplierCreated: (party: CreatedParty) => void;
  onCustomerCreated: (party: CreatedParty) => void;
  preferredKind?: QuickAddKind;
}

const pickerOptions: {
  kind: QuickAddKind;
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
  ring: string;
}[] = [
  {
    kind: "supplier",
    emoji: em.supplier,
    title: "إضافة مورد (جملة)",
    subtitle: "يُحفظ في دليل الموردين كتاجر جملة",
    accent: "from-indigo-500/20 via-indigo-400/5 to-transparent",
    ring: "hover:border-indigo-400/45 hover:shadow-[0_0_28px_-6px_rgba(99,102,241,0.55)]",
  },
  {
    kind: "customer",
    emoji: em.customers,
    title: "إضافة عميل",
    subtitle: "يُحفظ في شاشة العملاء",
    accent: "from-amber-500/20 via-amber-400/5 to-transparent",
    ring: "hover:border-amber-400/45 hover:shadow-[0_0_28px_-6px_rgba(245,158,11,0.5)]",
  },
];

export function PurchaseCounterpartyQuickAddTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="إضافة مورد أو عميل"
      aria-label="إضافة مورد أو عميل"
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        "border border-primary/35 bg-gradient-to-br from-primary/25 to-primary/5",
        "text-sm font-bold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.45)]",
        "transition-all hover:scale-105 hover:border-primary/55 hover:shadow-glow-sm",
        className
      )}
    >
      {em.add}
    </button>
  );
}

export default function PurchaseCounterpartyQuickAdd({
  open,
  onOpenChange,
  onSupplierCreated,
  onCustomerCreated,
  preferredKind,
}: PurchaseCounterpartyQuickAddProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [formKind, setFormKind] = useState<QuickAddKind | null>(null);
  const [form, setForm] = useState<PartyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const closeAll = () => {
    setFormKind(null);
    setForm(emptyForm);
    setSaving(false);
    onOpenChange(false);
  };

  const closeForm = () => {
    setFormKind(null);
    setForm(emptyForm);
    setSaving(false);
  };

  const openForm = (kind: QuickAddKind) => {
    setForm(emptyForm);
    setFormKind(kind);
  };

  useEffect(() => {
    if (!open) {
      setFormKind(null);
      setForm(emptyForm);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!formKind) return;
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [formKind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!formKind) return;

    const nameAr = form.nameAr.trim();
    const phone = form.phone.trim();
    if (!nameAr || !phone) {
      toast.error("الاسم ورقم الهاتف مطلوبان");
      return;
    }

    setSaving(true);
    const url = formKind === "supplier" ? "/api/suppliers" : "/api/customers";
    const { ok, data } = await apiJson<{
      supplier?: CreatedParty;
      customer?: CreatedParty;
      message?: string;
    }>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr,
        phone,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      }),
    });

    setSaving(false);
    if (!ok) {
      toast.error(data.message || "تعذّر الحفظ");
      return;
    }

    const created = formKind === "supplier" ? data.supplier : data.customer;

    if (!created?.id) {
      toast.error("تعذّر الحفظ");
      return;
    }

    toast.success(formKind === "supplier" ? "تم إضافة المورد" : "تم إضافة العميل");
    closeAll();

    if (formKind === "supplier") {
      onSupplierCreated(created);
    } else {
      onCustomerCreated(created);
    }
  };

  const formTitle = formKind === "supplier" ? "مورد جديد (جملة)" : "عميل جديد";
  const formHint =
    formKind === "supplier"
      ? "يُضاف لدليل الموردين مثل الإعدادات"
      : "يُضاف لشاشة العملاء مثل الإضافة من هناك";

  return (
    <>
      <Modal
        open={open && formKind == null}
        onClose={closeAll}
        title="إضافة سريعة"
        titleHint="من فاتورة الشراء"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted leading-relaxed">
            اختر نوع الطرف — يُحفظ في النظام ويُختار تلقائياً في الفاتورة.
          </p>
          {pickerOptions.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => openForm(option.kind)}
              className={cn(
                "relative w-full overflow-hidden rounded-2xl border border-border/80 p-4 text-right transition-all duration-300",
                "bg-background-input/40",
                option.ring,
                preferredKind === option.kind && "border-primary/40 ring-1 ring-primary/25"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-l opacity-80",
                  option.accent
                )}
                aria-hidden
              />
              <span className="relative flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/25 text-2xl border border-white/10">
                  {option.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{option.subtitle}</span>
                </span>
                <span className="text-muted text-lg shrink-0" aria-hidden>
                  ‹
                </span>
              </span>
            </button>
          ))}
          <button type="button" onClick={closeAll} className="btn-secondary w-full mt-1">
            إلغاء
          </button>
        </div>
      </Modal>

      <Modal open={formKind != null} onClose={closeForm} title={formTitle} titleHint={formHint} size="md">
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1.5">الاسم *</label>
              <input
                ref={nameInputRef}
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                className="glass-input w-full"
                placeholder={formKind === "supplier" ? "اسم المورد" : "اسم العميل"}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">الهاتف *</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="glass-input w-full"
                placeholder="01xxxxxxxxx"
                dir="ltr"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">البريد</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="glass-input w-full"
                placeholder="اختياري"
                dir="ltr"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1.5">العنوان</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="glass-input w-full"
                placeholder="اختياري"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 min-w-[140px]">
              {saving ? "جاري الحفظ..." : formKind === "supplier" ? "إضافة المورد" : "إضافة العميل"}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} className="btn-secondary px-5">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
