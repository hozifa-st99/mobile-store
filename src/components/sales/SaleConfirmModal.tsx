"use client";

import Modal from "@/components/ui/Modal";
import { em } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";

interface SaleConfirmLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface BranchEmployeeOption {
  id: string;
  employeeCode: string;
  nameAr: string;
}

interface SaleConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
  customerLabel: string;
  paymentLabel: string;
  itemCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: SaleConfirmLine[];
  employees: BranchEmployeeOption[];
  selectedEmployeeId: string;
  onEmployeeChange: (id: string) => void;
}

function InfoTile({
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
    <div className={`rounded-xl border p-3.5 ${borderClass} ${bgClass}`}>
      <p className="text-[11px] text-muted mb-1.5 inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        {label}
      </p>
      <p className={`text-sm font-bold leading-snug ${valueClass}`}>{value}</p>
    </div>
  );
}

function SummaryLine({
  emoji,
  label,
  value,
  strong,
}: {
  emoji: string;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${strong ? "pt-2.5 mt-0.5 border-t border-accent-green/25" : ""}`}
    >
      <span
        className={`inline-flex items-center gap-1.5 ${strong ? "text-sm font-bold text-white" : "text-xs text-muted"}`}
      >
        <span aria-hidden>{emoji}</span>
        {label}
      </span>
      <span
        className={`tabular-nums ${strong ? "text-base font-black text-accent-green" : "text-sm font-semibold text-white"}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function SaleConfirmModal({
  open,
  onClose,
  onConfirm,
  saving,
  customerLabel,
  paymentLabel,
  itemCount,
  subtotal,
  discount,
  tax,
  total,
  items,
  employees,
  selectedEmployeeId,
  onEmployeeChange,
}: SaleConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="تأكيد إتمام البيع" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <InfoTile
            emoji={em.customer}
            label="العميل"
            value={customerLabel}
            borderClass="border-accent-orange/30"
            bgClass="bg-accent-orange/5"
          />
          <InfoTile
            emoji={em.payment}
            label="طريقة الدفع"
            value={paymentLabel}
            borderClass="border-accent-blue/30"
            bgClass="bg-accent-blue/5"
            valueClass="text-accent-blue"
          />
          <InfoTile
            emoji={em.product}
            label="عدد الأصناف"
            value={itemCount}
            borderClass="border-primary/30"
            bgClass="bg-primary/5"
            valueClass="text-primary-light"
          />
        </div>

        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-primary/[0.12] via-background-card/90 to-background-secondary/80 shadow-glow-sm ring-1 ring-primary/25">
          <div className="px-4 py-3 bg-primary/15 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/25 flex items-center justify-center text-base" aria-hidden>
              {em.invoice}
            </span>
            <span className="text-sm font-bold text-white">أصناف الفاتورة</span>
          </div>

          <div className="max-h-44 overflow-y-auto px-1 pb-1">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[46%]" />
                <col className="w-[22%]" />
                <col className="w-[32%]" />
              </colgroup>
              <thead className="sticky top-0 z-[1]">
                <tr className="text-muted bg-background-card/95 backdrop-blur-sm">
                  <th className="px-3 py-2.5 text-start font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{em.product}</span>
                      الصنف
                    </span>
                  </th>
                  <th className="px-2 py-2.5 text-center font-medium">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <span aria-hidden>{em.quantity}</span>
                      الكمية
                    </span>
                  </th>
                  <th className="px-3 py-2.5 text-end font-medium">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span aria-hidden>{em.salePrice}</span>
                      المبلغ
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={i}
                    className="border-t border-primary/10 hover:bg-primary/[0.06] transition-colors"
                  >
                    <td className="px-3 py-2.5 text-white font-medium truncate" title={item.description}>
                      {item.description}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-primary-light font-bold text-sm">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums text-accent-green font-bold text-sm">
                      {formatCurrency(item.unitPrice)} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end px-3 pb-3 pt-1">
            <div className="w-full max-w-[300px] rounded-2xl border border-accent-green/35 bg-gradient-to-br from-accent-green/15 via-primary/10 to-background-card/90 p-4 space-y-2 shadow-glow-sm ring-1 ring-accent-green/20">
              <p className="text-[11px] font-bold text-accent-green/90 inline-flex items-center gap-1.5 mb-1">
                <span aria-hidden>💰</span>
                ملخص المبالغ
              </p>
              <SummaryLine emoji={em.total} label="المجموع" value={`${formatCurrency(subtotal)} ج.م`} />
              {discount > 0 && (
                <SummaryLine emoji="🏷️" label="خصم" value={`-${formatCurrency(discount)} ج.م`} />
              )}
              {tax > 0 && (
                <SummaryLine emoji={em.tax} label="ضريبة" value={`${formatCurrency(tax)} ج.م`} />
              )}
              <SummaryLine
                emoji="✅"
                label="الإجمالي النهائي"
                value={`${formatCurrency(total)} ج.م`}
                strong
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-primary/35 bg-gradient-to-br from-primary/10 to-primary/5 p-4 space-y-3 shadow-glow-sm">
          <div>
            <p className="text-sm font-bold text-white inline-flex items-center gap-2">
              <span aria-hidden>👔</span>
              بواسطة مين؟
            </p>
            <p className="text-xs text-muted mt-1">اختر الموظف الذي كان مع الزبون — للمكافآت لاحقاً</p>
          </div>
          {employees.length === 0 ? (
            <p className="text-sm text-accent-orange rounded-lg border border-accent-orange/30 bg-accent-orange/5 px-3 py-2">
              لا يوجد موظفين —{" "}
              <a href="/dashboard/branch-employees?new=1" className="underline hover:text-white">
                أضف موظفاً أولاً
              </a>
            </p>
          ) : (
            <select
              value={selectedEmployeeId}
              onChange={(e) => onEmployeeChange(e.target.value)}
              className="glass-input w-full text-sm h-12"
            >
              <option value="">— اختر الموظف —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeCode} — {emp.nameAr}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !selectedEmployeeId || employees.length === 0}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "✅ تأكيد وإتمام البيع"}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-6">
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
