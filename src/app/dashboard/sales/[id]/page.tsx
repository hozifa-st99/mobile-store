"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import InvoiceCreatorBadge, {
  InvoiceNumberWithCreator,
} from "@/components/invoices/InvoiceCreatorBadge";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";
import { formatStoredDeviceImeis } from "@/lib/product-serial-imeis";
import { apiJson } from "@/lib/api-client";
import type { InvoiceCreatorInfo } from "@/lib/invoice-creator";

interface SaleItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  total: number;
  imei: string | null;
  barcode: string | null;
  isPhone?: boolean;
}

function SaleLineIdentifier({
  item,
}: {
  item: Pick<SaleItem, "imei" | "barcode" | "isPhone">;
}) {
  if (item.isPhone && item.imei) {
    return (
      <p className="text-[11px] text-muted-dark mt-0.5">
        IMEI: {formatStoredDeviceImeis(item.imei)}
      </p>
    );
  }
  if (!item.isPhone && item.barcode) {
    return (
      <p className="text-[11px] text-muted-dark mt-0.5">باركود: {item.barcode}</p>
    );
  }
  return null;
}

interface SaleDetail {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  status: string;
  returnStatus?: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  customer?: { nameAr: string } | null;
  createdBy?: InvoiceCreatorInfo | null;
  items: SaleItem[];
}

interface SaleReturnLog {
  id: string;
  returnNumber: string;
  returnDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  userName: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    imei: string | null;
    barcode: string | null;
  }[];
}

const statusMap: Record<string, { label: string; class: string }> = {
  completed: { label: "مكتمل", class: "status-complete" },
  pending: { label: "قيد الانتظار", class: "status-pending" },
};

const returnStatusMap: Record<string, { label: string; class: string }> = {
  partial: { label: "مرتجع جزئي", class: "status-pending" },
  full: { label: "مرتجع كامل", class: "status-complete" },
};

const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  installment: "أقساط",
};

export default function SaleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [returns, setReturns] = useState<SaleReturnLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiJson<{ sale?: SaleDetail; returns?: SaleReturnLog[]; message?: string }>(
      `/api/sales/${id}`
    ).then(({ ok, data }) => {
      if (ok && data.sale) {
        setSale(data.sale);
        setReturns(data.returns ?? []);
      } else {
        setError(data.message || "تعذر تحميل الفاتورة");
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <>
        <PageHeader title="تفاصيل فاتورة البيع" subtitle="جاري التحميل..." />
        <div className="glass-card p-12 text-center text-muted">جاري التحميل...</div>
      </>
    );
  }

  if (error || !sale) {
    return (
      <>
        <PageHeader title="تفاصيل فاتورة البيع" subtitle="خطأ" />
        <div className="glass-card p-12 text-center space-y-4">
          <p className="text-red-400">{error || "الفاتورة غير موجودة"}</p>
          <Link
            href="/dashboard/sales"
            className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/20 border border-primary/40 text-primary-light"
          >
            ← العودة للقائمة
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3 flex-wrap">
            <span>فاتورة {sale.invoiceNumber}</span>
            <InvoiceCreatorBadge creator={sale.createdBy} />
          </span>
        }
        subtitle={`${sale.customer?.nameAr || "عميل نقدي"} · ${new Date(sale.saleDate).toLocaleDateString("ar-EG")}${sale.createdBy ? ` · الحساب: ${sale.createdBy.username}` : ""}`}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          href="/dashboard/sales"
          className="inline-flex text-sm text-muted hover:text-primary-light transition-colors"
        >
          ← العودة لاستعراض الفواتير
        </Link>
        <Link
          href={`/dashboard/sales/${id}/print`}
          className="inline-flex text-sm font-semibold text-primary-light hover:underline"
        >
          🖨️ طباعة الفاتورة
        </Link>
        {sale.returnStatus !== "full" && sale.status === "completed" && (
          <Link
            href={`/dashboard/sales/returns?saleId=${sale.id}`}
            className="inline-flex text-sm text-accent-orange hover:underline"
          >
            + تسجيل مرتجع
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="glass-card p-5 lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-white">بيانات الفاتورة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted mb-1">رقم الفاتورة</p>
              <p className="font-semibold text-primary-light">
                <InvoiceNumberWithCreator
                  invoiceNumber={sale.invoiceNumber}
                  creator={sale.createdBy}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">التاريخ</p>
              <p>{new Date(sale.saleDate).toLocaleDateString("ar-EG")}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">العميل</p>
              <p>{sale.customer?.nameAr || "عميل نقدي"}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">طريقة الدفع</p>
              <p>{paymentLabels[sale.paymentMethod] || sale.paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">الحالة</p>
              <span className={statusMap[sale.status]?.class || "status-pending"}>
                {statusMap[sale.status]?.label || sale.status}
              </span>
            </div>
            {sale.returnStatus && sale.returnStatus !== "none" && (
              <div>
                <p className="text-xs text-muted mb-1">المرتجع</p>
                <span className={returnStatusMap[sale.returnStatus]?.class || "status-pending"}>
                  {returnStatusMap[sale.returnStatus]?.label || sale.returnStatus}
                </span>
              </div>
            )}
          </div>
          {sale.notes && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted mb-1">ملاحظات</p>
              <p className="text-sm text-muted whitespace-pre-wrap">{sale.notes}</p>
            </div>
          )}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-white">الإجماليات</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>المجموع</span>
              <span className="tabular-nums">{formatCurrency(sale.subtotal)} ج.م</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>خصم</span>
                <span className="tabular-nums">- {formatCurrency(sale.discount)} ج.م</span>
              </div>
            )}
            {sale.taxAmount > 0 ? (
              <div className="flex justify-between text-muted">
                <span>ضريبة ({sale.taxRate}%)</span>
                <span className="tabular-nums">{formatCurrency(sale.taxAmount)} ج.م</span>
              </div>
            ) : (
              <div className="flex justify-between text-muted text-xs">
                <span>ضريبة</span>
                <span>بدون ضريبة</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-accent-green pt-2 border-t border-border">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(sale.total)} ج.م</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.product} className="text-right p-4 font-medium">
                  الصنف
                </ThEmoji>
                <th className="text-right p-4 font-medium">الكمية</th>
                <th className="text-right p-4 font-medium">السعر</th>
                <th className="text-right p-4 font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-border/40">
                  <td className="p-4 text-sm text-white">
                    <p>{item.description}</p>
                    <SaleLineIdentifier item={item} />
                  </td>
                  <td className="p-4 text-sm tabular-nums">{item.quantity}</td>
                  <td className="p-4 text-sm tabular-nums">{formatCurrency(item.unitPrice)}</td>
                  <td className="p-4 text-sm font-semibold tabular-nums">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {returns.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">سجل المرتجعات ({returns.length})</h2>
          <div className="space-y-4">
            {returns.map((ret) => (
              <div
                key={ret.id}
                className="rounded-xl border border-border/60 bg-background-input/30 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary-light">{ret.returnNumber}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(ret.returnDate).toLocaleString("ar-EG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {ret.userName ? ` · ${ret.userName}` : ""}
                    </p>
                  </div>
                  <div className="text-left min-w-[140px]">
                    <p className="text-xs text-muted">مبلغ المرتجع</p>
                    <div className="text-sm space-y-0.5 mt-1">
                      {ret.discount > 0 && (
                        <p className="text-[11px] text-muted tabular-nums">
                          خصم: - {formatCurrency(ret.discount)}
                        </p>
                      )}
                      {ret.taxAmount > 0 && (
                        <p className="text-[11px] text-muted tabular-nums">
                          ضريبة ({ret.taxRate}%): {formatCurrency(ret.taxAmount)}
                        </p>
                      )}
                      <p className="font-bold text-accent-green tabular-nums">
                        {formatCurrency(ret.total)} ج.م
                      </p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted text-xs border-b border-border/50">
                        <th className="text-right p-2 font-medium">الصنف</th>
                        <th className="text-right p-2 font-medium">الكمية</th>
                        <th className="text-right p-2 font-medium">السعر</th>
                        <th className="text-right p-2 font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ret.items.map((item) => (
                        <tr key={item.id} className="border-b border-border/30 last:border-0">
                          <td className="p-2">
                            <p>{item.description}</p>
                            {item.imei && (
                              <p className="text-[11px] text-muted-dark mt-0.5">
                                IMEI: {formatStoredDeviceImeis(item.imei)}
                              </p>
                            )}
                            {!item.imei && item.barcode && (
                              <p className="text-[11px] text-muted-dark mt-0.5">
                                باركود: {item.barcode}
                              </p>
                            )}
                          </td>
                          <td className="p-2 tabular-nums">{item.quantity}</td>
                          <td className="p-2 tabular-nums">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-2 tabular-nums">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ret.notes && (
                  <p className="text-xs text-muted whitespace-pre-wrap">{ret.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
