"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
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

  return (
    <>
      <PageHeader
        title="خزنة الفرع"
        subtitle="نقدية التقفيلات السابقة وحركات السحب والإيداع"
        showHomeButton
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
            المشتريات من هذه الخزنة أو من الوردية الحالية.
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
                    لا توجد حركات بعد — قفل وردية لإيداع النقدية
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
                    <td className="p-4 text-sm text-muted">{row.description}</td>
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
    </>
  );
}
