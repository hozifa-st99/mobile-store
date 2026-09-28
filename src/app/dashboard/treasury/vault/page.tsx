"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import Modal from "@/components/ui/Modal";
import TransactionTypeBadge from "@/components/ui/TransactionTypeBadge";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import {
  ClearableDateInput,
  ClearableInput,
  FilterSelectWithLabel,
} from "@/components/ui/FilterControls";
import { BRANCH_VAULT_TYPE_FILTER_OPTIONS } from "@/lib/branch-vault-types";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatAmountExact } from "@/lib/utils";

interface VaultMovement {
  id: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  amount: number;
  movementDate: string;
  documentNumber: string | null;
  description: string;
  notes: string | null;
  detailUrl: string | null;
}

const directionClass: Record<string, string> = {
  in: "text-accent-green",
  out: "text-red-400",
};

export default function BranchVaultPage() {
  const [balance, setBalance] = useState(0);
  const [movements, setMovements] = useState<VaultMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [movementType, setMovementType] = useState("");
  const [modalAction, setModalAction] = useState<"deposit" | "withdraw" | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [saving, setSaving] = useState(false);

  const loadVault = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (invoiceNumber.trim()) params.set("invoiceNumber", invoiceNumber.trim());
    if (movementType) params.set("type", movementType);
    const q = params.toString();
    const { ok, data } = await apiJson<{ balance: number; movements: VaultMovement[] }>(
      `/api/treasury/vault${q ? `?${q}` : ""}`
    );
    if (ok) {
      setBalance(data.balance ?? 0);
      setMovements(data.movements || []);
    }
    setLoading(false);
  }, [dateFrom, dateTo, invoiceNumber, movementType]);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  const closeModal = () => {
    if (saving) return;
    setModalAction(null);
    setAmountInput("");
    setNotesInput("");
  };

  const submitManualCash = async () => {
    if (!modalAction) return;
    const amount = Number(amountInput);
    setSaving(true);
    const { ok, data } = await apiJson<{ message?: string }>(
      "/api/treasury/vault",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalAction,
          amount,
          notes: notesInput.trim() || undefined,
        }),
      }
    );
    setSaving(false);
    if (!ok) {
      toast.error(data.message || "تعذر تنفيذ حركة الخزنة");
      return;
    }
    toast.success(data.message || "تم حفظ الحركة");
    setModalAction(null);
    setAmountInput("");
    setNotesInput("");
    await loadVault();
  };

  return (
    <>
      <PageHeader
        title="خزنة الفرع"
        subtitle="نقدية التقفيلات السابقة وحركات السحب والإيداع"
        showHomeButton
        extraAction={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModalAction("deposit")}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-accent-green/15 text-accent-green text-sm font-bold border border-accent-green/30 hover:bg-accent-green/25 transition-all"
            >
              إيداع
            </button>
            <button
              type="button"
              onClick={() => setModalAction("withdraw")}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-red-500/15 text-red-400 text-sm font-bold border border-red-500/30 hover:bg-red-500/25 transition-all"
            >
              سحب
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <KpiCard
          title="رصيد خزنة الفرع"
          value={balance}
          suffix="ج.م"
          emoji="🏦"
          variant="sales"
        />
        <div className="glass-card p-4 flex flex-col justify-center text-sm text-muted">
          <p>
            عند تقفيل الوردية، النقدية الصافية تُودَع تلقائياً في خزنة الفرع. يمكن دفع فواتير
            المشتريات من هذه الخزنة أو من الوردية الحالية. الإيداع والسحب اليدوي يخصّان خزنة
            الفرع فقط.
          </p>
          <Link href="/dashboard/treasury" className="text-primary-light underline mt-2 text-xs">
            الانتقال إلى تقفيل الوردية
          </Link>
        </div>
      </div>

      <div className="glass-card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1.5">من تاريخ</label>
            <ClearableDateInput
              value={dateFrom}
              onChange={setDateFrom}
              onClear={() => setDateFrom("")}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">إلى تاريخ</label>
            <ClearableDateInput
              value={dateTo}
              onChange={setDateTo}
              onClear={() => setDateTo("")}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">النوع</label>
            <FilterSelectWithLabel
              value={movementType}
              onChange={setMovementType}
              onClear={() => setMovementType("")}
              selectClassName="glass-input w-full"
            >
              <option value="">— الكل —</option>
              {BRANCH_VAULT_TYPE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FilterSelectWithLabel>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">رقم الفاتورة</label>
            <ClearableInput
              value={invoiceNumber}
              onChange={setInvoiceNumber}
              onClear={() => setInvoiceNumber("")}
              placeholder="بحث برقم المستند..."
              inputMode="search"
            />
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji="📅" className="text-right p-4 font-medium">
                  التاريخ
                </ThEmoji>
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  المستند
                </ThEmoji>
                <ThEmoji emoji="📋" className="text-right p-4 font-medium">
                  النوع
                </ThEmoji>
                <ThEmoji emoji="📝" className="text-right p-4 font-medium">
                  البيان
                </ThEmoji>
                <ThEmoji emoji="💰" className="text-right p-4 font-medium">
                  المبلغ
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
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted">
                    لا توجد حركات بعد
                  </td>
                </tr>
              ) : (
                movements.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <DocumentDateTimeStack value={row.movementDate} />
                    </td>
                    <td className="p-4 text-sm">
                      {row.detailUrl ? (
                        <Link href={row.detailUrl} className="text-primary-light hover:underline">
                          {row.documentNumber || "—"}
                        </Link>
                      ) : (
                        row.documentNumber || "—"
                      )}
                    </td>
                    <td className="p-4">
                      <TransactionTypeBadge type={row.type} label={row.typeLabel} />
                    </td>
                    <td className="p-4 text-sm text-muted">
                      <span>{row.description}</span>
                      {row.notes ? (
                        <span className="block text-xs mt-1 opacity-80">{row.notes}</span>
                      ) : null}
                    </td>
                    <td
                      className={`p-4 tabular-nums font-bold ${directionClass[row.direction] || ""}`}
                    >
                      {row.direction === "in" ? "+" : "−"}
                      {formatAmountExact(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalAction !== null}
        onClose={closeModal}
        title={modalAction === "withdraw" ? "سحب من خزنة الفرع" : "إيداع في خزنة الفرع"}
        size="sm"
      >
        <p className="text-sm text-muted mb-4">
          الرصيد الحالي:{" "}
          <strong className="text-white tabular-nums">{formatAmountExact(balance)} ج.م</strong>
        </p>
        <label className="block text-xs text-muted mb-1.5">المبلغ</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          className="glass-input w-full mb-3"
          placeholder="0.00"
        />
        <label className="block text-xs text-muted mb-1.5">ملاحظات (اختياري)</label>
        <textarea
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          className="glass-input w-full mb-5 min-h-[80px]"
          placeholder="سبب الحركة..."
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void submitManualCash()}
            disabled={saving}
            className={
              modalAction === "withdraw"
                ? "px-5 py-2.5 rounded-xl bg-red-500/20 text-red-300 text-sm font-bold border border-red-500/30 disabled:opacity-50"
                : "px-5 py-2.5 rounded-xl bg-accent-green/20 text-accent-green text-sm font-bold border border-accent-green/30 disabled:opacity-50"
            }
          >
            {saving ? "جاري الحفظ..." : modalAction === "withdraw" ? "تأكيد السحب" : "تأكيد الإيداع"}
          </button>
        </div>
      </Modal>
    </>
  );
}
