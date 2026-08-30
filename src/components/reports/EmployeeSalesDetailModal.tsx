"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import Modal from "@/components/ui/Modal";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import type { ReportFilterState } from "@/components/reports/ReportDateFilter";
import { apiJson } from "@/lib/api-client";
import { appendReportQuery } from "@/lib/report-query";
import { formatCurrency } from "@/lib/utils";

interface EmployeeSalesRow {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  total: number;
  paymentMethod: string;
  paymentLabel: string;
  customerName: string;
  itemCount: number;
}

interface SoldLine {
  id: string;
  description: string;
  quantity: number;
  total: number;
  invoiceNumber: string;
  saleDate: string;
  imei?: string | null;
}

interface EmployeeSalesData {
  employee: { id: string; nameAr: string; employeeCode: string };
  periodLabel: string;
  rows: EmployeeSalesRow[];
  totals: {
    count: number;
    total: number;
    items: number;
    phones: { quantity: number; amount: number };
    accessories: { quantity: number; amount: number };
  };
  phoneLines: SoldLine[];
  accessoryLines: SoldLine[];
}

interface EmployeeSalesDetailModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: string | null;
  employeeName: string;
  filter: ReportFilterState;
}

type DetailView = "invoices" | "mix" | "accessories" | "phones";

function MiniStat({
  emoji,
  label,
  value,
  borderClass,
  bgClass,
  valueClass = "text-white",
  onClick,
}: {
  emoji: string;
  label: string;
  value: string | number;
  borderClass: string;
  bgClass: string;
  valueClass?: string;
  onClick?: () => void;
}) {
  const className = `rounded-xl border p-3 text-right w-full ${borderClass} ${bgClass} ${
    onClick ? "cursor-pointer hover:brightness-110 transition-[filter,box-shadow] hover:shadow-glow-sm" : ""
  }`;
  const body = (
    <>
      <p className="text-[11px] text-muted mb-1 inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        {label}
      </p>
      <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function CategoryCard({
  emoji,
  title,
  quantity,
  amount,
  borderClass,
  bgClass,
  valueClass,
  onClick,
}: {
  emoji: string;
  title: string;
  quantity: number;
  amount: number;
  borderClass: string;
  bgClass: string;
  valueClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-right w-full ${borderClass} ${bgClass} hover:brightness-110 transition-[filter,box-shadow] hover:shadow-glow-sm`}
    >
      <p className="text-sm font-bold text-white mb-3 inline-flex items-center gap-1.5">
        <span aria-hidden>{emoji}</span>
        {title}
      </p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted mb-0.5">العدد</p>
          <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{quantity}</p>
        </div>
        <div className="text-left">
          <p className="text-[11px] text-muted mb-0.5">المبلغ</p>
          <p className="text-lg font-bold tabular-nums text-accent-green">{formatCurrency(amount)} ج.م</p>
        </div>
      </div>
      <p className="text-[11px] text-muted mt-3">اضغط لعرض البنود</p>
    </button>
  );
}

function LinesTable({
  lines,
  kind,
  emptyLabel,
}: {
  lines: SoldLine[];
  kind: "phones" | "accessories";
  emptyLabel: string;
}) {
  const showImei = kind === "phones";
  const colSpan = showImei ? 6 : 5;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${showImei ? "min-w-[860px]" : "min-w-[720px]"}`}>
        <thead>
          <tr className="text-xs text-muted-dark border-b border-primary/15 bg-background-input/40">
            <ThEmoji emoji={em.description} className="text-right p-4 font-medium">
              الصنف
            </ThEmoji>
            {showImei && (
              <ThEmoji emoji={em.imei} className="text-right p-4 font-medium">
                رقم الجهاز
              </ThEmoji>
            )}
            <ThEmoji emoji={em.quantity} className="text-center p-4 font-medium w-24">
              العدد
            </ThEmoji>
            <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
              المبلغ
            </ThEmoji>
            <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
              الفاتورة
            </ThEmoji>
            <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
              التاريخ
            </ThEmoji>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="p-12 text-center text-muted">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            lines.map((line) => (
              <tr key={line.id} className="border-b border-primary/10 hover:bg-primary/[0.05] transition-colors">
                <td className="p-4 text-white font-medium">
                  <CellEmoji emoji={kind === "phones" ? em.device : em.product}>{line.description}</CellEmoji>
                </td>
                {showImei && (
                  <td className="p-4 font-mono text-xs text-muted" dir="ltr">
                    {line.imei || "—"}
                  </td>
                )}
                <td className="p-4 text-center tabular-nums font-semibold text-white">{line.quantity}</td>
                <td className="p-4 tabular-nums font-bold text-accent-green">
                  {formatCurrency(line.total)} ج.م
                </td>
                <td className="p-4 font-mono text-primary-light">{line.invoiceNumber}</td>
                <td className="p-4">
                  <DocumentDateTimeStack value={line.saleDate} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployeeSalesDetailModal({
  open,
  onClose,
  employeeId,
  employeeName,
  filter,
}: EmployeeSalesDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EmployeeSalesData | null>(null);
  const [view, setView] = useState<DetailView>("invoices");

  useEffect(() => {
    setView("invoices");
    if (!open || !employeeId) {
      setData(null);
      return;
    }
    setLoading(true);
    const url = appendReportQuery(`/api/reports/employees/${employeeId}/sales`, filter);
    apiJson<EmployeeSalesData>(url).then(({ ok, data: res }) => {
      if (ok && res) setData(res);
      setLoading(false);
    });
  }, [open, employeeId, filter]);

  const heading =
    view === "mix"
      ? "تفصيل الأصناف"
      : view === "accessories"
        ? "بنود الإكسسوارات"
        : view === "phones"
          ? "بنود الموبايلات"
          : "فواتير الموظف";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`فواتير ${employeeName}`}
      titleHint={data?.periodLabel}
      size="xl"
    >
      {loading ? (
        <div className="py-16 text-center text-muted animate-pulse">جاري التحميل...</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted">تعذّر تحميل الفواتير</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MiniStat
              emoji={em.invoice}
              label="عدد الفواتير"
              value={data.totals.count}
              borderClass="border-primary/30"
              bgClass="bg-primary/5"
            />
            <MiniStat
              emoji={em.product}
              label="عدد الأصناف"
              value={data.totals.items}
              borderClass={view === "mix" ? "border-accent-blue/60 ring-1 ring-accent-blue/30" : "border-accent-blue/30"}
              bgClass="bg-accent-blue/5"
              valueClass="text-accent-blue"
              onClick={() => setView(view === "mix" ? "invoices" : "mix")}
            />
            <MiniStat
              emoji={em.total}
              label="إجمالي المبيعات"
              value={`${formatCurrency(data.totals.total)} ج.م`}
              borderClass="border-accent-green/30"
              bgClass="bg-accent-green/5"
              valueClass="text-accent-green text-base"
            />
          </div>

          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-primary/[0.1] via-background-card/90 to-background-secondary/80 ring-1 ring-primary/20 shadow-glow-sm">
            <div className="px-4 py-3 bg-primary/12 flex items-center gap-2 border-b border-primary/15">
              <span className="w-8 h-8 rounded-lg bg-primary/25 flex items-center justify-center" aria-hidden>
                {view === "phones" ? em.device : view === "accessories" ? em.product : em.invoice}
              </span>
              <span className="text-sm font-bold text-white">{heading}</span>
              <span className="text-xs text-muted mr-auto">{data.employee.employeeCode}</span>
              {view !== "invoices" && (
                <button
                  type="button"
                  onClick={() => setView(view === "mix" ? "invoices" : "mix")}
                  className="h-8 px-3 rounded-lg text-xs font-bold border border-border text-muted hover:text-white transition-colors"
                >
                  رجوع
                </button>
              )}
            </div>

            {view === "invoices" && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-dark border-b border-primary/15 bg-background-input/40">
                      <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                        رقم الفاتورة
                      </ThEmoji>
                      <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                        التاريخ
                      </ThEmoji>
                      <ThEmoji emoji={em.customer} className="text-right p-4 font-medium">
                        العميل
                      </ThEmoji>
                      <ThEmoji emoji={em.payment} className="text-center p-4 font-medium">
                        الدفع
                      </ThEmoji>
                      <ThEmoji emoji={em.product} className="text-center p-4 font-medium w-24">
                        الأصناف
                      </ThEmoji>
                      <ThEmoji emoji={em.total} className="text-right p-4 font-medium">
                        المبلغ
                      </ThEmoji>
                      <ThEmoji emoji={em.view} className="text-center p-4 font-medium w-24">
                        عرض
                      </ThEmoji>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-muted">
                          لا توجد فواتير لهذا الموظف في الفترة المحددة
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-primary/10 hover:bg-primary/[0.05] transition-colors"
                        >
                          <td className="p-4 font-mono font-bold text-primary-light">{row.invoiceNumber}</td>
                          <td className="p-4">
                            <DocumentDateTimeStack value={row.saleDate} />
                          </td>
                          <td className="p-4 text-white font-medium">
                            <CellEmoji emoji={em.customer}>{row.customerName}</CellEmoji>
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-accent-blue/10 text-accent-blue border border-accent-blue/25">
                              <span aria-hidden>{em.payment}</span>
                              {row.paymentLabel}
                            </span>
                          </td>
                          <td className="p-4 text-center tabular-nums font-semibold text-white">
                            {row.itemCount}
                          </td>
                          <td className="p-4 tabular-nums font-bold text-accent-green">
                            {formatCurrency(row.total)} ج.م
                          </td>
                          <td className="p-4 text-center">
                            <Link
                              href={`/dashboard/sales/${row.id}`}
                              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold bg-primary/15 text-primary-light border border-primary/30 hover:bg-primary/25 hover:text-white transition-colors"
                            >
                              <span aria-hidden>{em.view}</span>
                              فتح
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {view === "mix" && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CategoryCard
                  emoji={em.product}
                  title="إكسسوارات"
                  quantity={data.totals.accessories?.quantity ?? 0}
                  amount={data.totals.accessories?.amount ?? 0}
                  borderClass="border-accent-blue/30"
                  bgClass="bg-accent-blue/5"
                  valueClass="text-accent-blue"
                  onClick={() => setView("accessories")}
                />
                <CategoryCard
                  emoji={em.device}
                  title="أجهزة"
                  quantity={data.totals.phones?.quantity ?? 0}
                  amount={data.totals.phones?.amount ?? 0}
                  borderClass="border-primary/30"
                  bgClass="bg-primary/5"
                  valueClass="text-primary-light"
                  onClick={() => setView("phones")}
                />
              </div>
            )}

            {view === "accessories" && (
              <LinesTable
                lines={data.accessoryLines ?? []}
                kind="accessories"
                emptyLabel="لا توجد إكسسوارات مباعة لهذا الموظف في الفترة المحددة"
              />
            )}

            {view === "phones" && (
              <LinesTable
                lines={data.phoneLines ?? []}
                kind="phones"
                emptyLabel="لا توجد أجهزة مباعة لهذا الموظف في الفترة المحددة"
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
