"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ThEmoji, CellEmoji, em } from "@/components/ui/TableEmoji";
import { useDashboard } from "./DashboardProvider";

export default function RecentInvoices() {
  const { recentSales: invoices } = useDashboard();

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title inline-flex items-center gap-2">
          <span>{em.invoice}</span>
          آخر الفواتير
        </h2>
        <Link
          href="/dashboard/sales"
          className="text-xs font-medium text-primary-light hover:text-white px-3 py-1.5 rounded-lg border border-primary/30 hover:bg-primary/10 transition-all"
        >
          عرض الكل
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-dark border-b border-border">
              <ThEmoji emoji={em.invoice} className="text-right pb-3 font-medium">
                رقم الفاتورة
              </ThEmoji>
              <ThEmoji emoji={em.customer} className="text-right pb-3 font-medium">
                العميل
              </ThEmoji>
              <ThEmoji emoji={em.total} className="text-right pb-3 font-medium">
                الإجمالي
              </ThEmoji>
              <ThEmoji emoji={em.status} className="text-right pb-3 font-medium">
                الحالة
              </ThEmoji>
              <ThEmoji emoji={em.date} className="text-right pb-3 font-medium">
                التاريخ
              </ThEmoji>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted text-sm">
                  لا توجد فواتير بعد
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr
                  key={inv.invoiceNumber}
                  className="border-b border-border/40 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3.5 text-sm text-primary-light font-semibold">
                    <CellEmoji emoji={em.invoice}>{inv.invoiceNumber}</CellEmoji>
                  </td>
                  <td className="py-3.5 text-sm text-muted">
                    <CellEmoji emoji={em.customer}>{inv.customer}</CellEmoji>
                  </td>
                  <td className="py-3.5 text-sm text-white font-semibold">
                    <CellEmoji emoji={em.total}>
                      {formatCurrency(inv.total)}{" "}
                      <span className="text-muted-dark font-normal text-xs">ج.م</span>
                    </CellEmoji>
                  </td>
                  <td className="py-3.5">
                    <span
                      className={
                        inv.status === "completed" ? "status-complete" : "status-pending"
                      }
                    >
                      {inv.status === "completed" ? "مكتمل" : "قيد الانتظار"}
                    </span>
                  </td>
                  <td className="py-3.5 text-xs text-muted-dark">
                    <CellEmoji emoji={em.date}>
                      {new Date(inv.date).toLocaleDateString("ar-EG")}
                    </CellEmoji>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
