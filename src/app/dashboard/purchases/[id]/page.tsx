"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import InvoiceCreatorBadge, {
  InvoiceNumberWithCreator,
} from "@/components/invoices/InvoiceCreatorBadge";
import PurchaseBarcodePrintModal from "@/components/purchases/PurchaseBarcodePrintModal";
import PurchaseInvoiceLinesTable from "@/components/purchases/PurchaseInvoiceLinesTable";
import { em } from "@/components/ui/TableEmoji";
import {
  buildSavedPurchaseItemRows,
  purchaseItemsHaveExpenses,
  sumPurchaseItemsAfter,
  sumPurchaseItemsBefore,
} from "@/lib/purchase-detail-display";
import { splitExpenseNotes } from "@/lib/purchase-invoice-notes";
import { formatStoredDeviceImeis } from "@/lib/product-serial-imeis";
import { formatCurrency } from "@/lib/utils";
import { apiJson } from "@/lib/api-client";
import type { InvoiceCreatorInfo } from "@/lib/invoice-creator";

interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitPriceBefore?: number | null;
  effectiveUnitPrice?: number | null;
  retailPrice: number;
  total: number;
  barcode: string | null;
  imeisSnapshot?: string | null;
  deviceCondition: string;
  boxCondition: string | null;
  batteryPercent: number | null;
  itemNotes: string | null;
}

interface PurchaseDetail {
  id: string;
  invoiceNumber: string;
  purchaseDate: string;
  dueDate: string | null;
  status: string;
  returnStatus?: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentType?: string;
  paidAmount?: number;
  creditOutstanding?: number;
  cashSource?: string | null;
  notes: string | null;
  supplier: { nameAr: string; phone?: string | null };
  createdBy?: InvoiceCreatorInfo | null;
  items: PurchaseItem[];
}

interface PurchaseReturnLog {
  id: string;
  returnNumber: string;
  returnDate: string;
  subtotal: number;
  total: number;
  notes: string | null;
  expenseHandling: string | null;
  expenseAmount: number;
  expenseRecoveredAmount: number;
  userName: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    imeisSnapshot: string | null;
  }[];
}

const returnStatusMap: Record<string, { label: string; class: string }> = {
  none: { label: "بدون مرتجع", class: "text-muted" },
  partial: { label: "مرتجع جزئي", class: "status-pending" },
  full: { label: "مرتجع كامل", class: "status-complete" },
};

const statusMap: Record<string, { label: string; class: string }> = {
  completed: { label: "مكتمل", class: "status-complete" },
  pending: { label: "قيد الانتظار", class: "status-pending" },
};

const paymentTypeLabels: Record<string, string> = {
  full_cash: "دفع كلي",
  credit: "أجل",
  partial_credit: "أجل جزئي",
};

const cashSourceLabels: Record<string, string> = {
  shift: "الوردية",
  vault: "خزنة الفرع",
};

export default function PurchaseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [returns, setReturns] = useState<PurchaseReturnLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiJson<{ purchase?: PurchaseDetail; returns?: PurchaseReturnLog[]; message?: string }>(
      `/api/purchases/${id}`
    ).then(({ ok, data }) => {
      if (ok && data.purchase) {
        setPurchase(data.purchase);
        setReturns(data.returns ?? []);
      } else {
        setError(data.message || "تعذر تحميل الفاتورة");
      }
      setLoading(false);
    });
  }, [id]);

  const hasExpenses = purchase ? purchaseItemsHaveExpenses(purchase.items) : false;
  const tableRows = useMemo(
    () => (purchase ? buildSavedPurchaseItemRows(purchase.items) : []),
    [purchase]
  );

  if (loading) {
    return (
      <>
        <PageHeader title="تفاصيل فاتورة الشراء" subtitle="جاري التحميل..." />
        <div className="glass-card p-12 text-center text-muted">جاري التحميل...</div>
      </>
    );
  }

  if (error || !purchase) {
    return (
      <>
        <PageHeader title="تفاصيل فاتورة الشراء" subtitle="خطأ" />
        <div className="glass-card p-12 text-center space-y-4">
          <p className="text-red-400">{error || "الفاتورة غير موجودة"}</p>
          <Link
            href="/dashboard/purchases"
            className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/20 border border-primary/40 text-primary-light"
          >
            ← العودة للقائمة
          </Link>
        </div>
      </>
    );
  }

  const subtotalBefore = sumPurchaseItemsBefore(purchase.items);
  const subtotalAfter = sumPurchaseItemsAfter(purchase.items);
  const expenseAmount = hasExpenses ? subtotalAfter - subtotalBefore : 0;
  const { userNotes, expenseLine } = splitExpenseNotes(purchase.notes);

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3 flex-wrap">
            <span>فاتورة {purchase.invoiceNumber}</span>
            <InvoiceCreatorBadge creator={purchase.createdBy} />
          </span>
        }
        subtitle={`${purchase.supplier.nameAr} · ${new Date(purchase.purchaseDate).toLocaleDateString("ar-EG")}${purchase.createdBy ? ` · الحساب: ${purchase.createdBy.username}` : ""}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/purchases"
          className="inline-flex text-sm text-muted hover:text-primary-light transition-colors"
        >
          ← العودة لاستعراض الفواتير
        </Link>
        <button
          type="button"
          onClick={() => setBarcodeModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-border bg-white/5 text-white hover:bg-white/10 transition-colors"
        >
          <span aria-hidden>{em.print}</span>
          طباعة باركود
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="glass-card p-5 lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-white">بيانات الفاتورة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted mb-1">رقم الفاتورة</p>
              <p className="font-semibold text-primary-light">
                <InvoiceNumberWithCreator
                  invoiceNumber={purchase.invoiceNumber}
                  creator={purchase.createdBy}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">التاريخ</p>
              <p>{new Date(purchase.purchaseDate).toLocaleDateString("ar-EG")}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">المورد</p>
              <p>{purchase.supplier.nameAr}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">الحالة</p>
              <span className={statusMap[purchase.status]?.class || "status-pending"}>
                {statusMap[purchase.status]?.label || purchase.status}
              </span>
            </div>
            {purchase.returnStatus && purchase.returnStatus !== "none" && (
              <div>
                <p className="text-xs text-muted mb-1">المرتجع</p>
                <span
                  className={
                    returnStatusMap[purchase.returnStatus]?.class || "status-pending"
                  }
                >
                  {returnStatusMap[purchase.returnStatus]?.label || purchase.returnStatus}
                </span>
              </div>
            )}
            {purchase.dueDate && (
              <div>
                <p className="text-xs text-muted mb-1">تاريخ الاستحقاق</p>
                <p>{new Date(purchase.dueDate).toLocaleDateString("ar-EG")}</p>
              </div>
            )}
            {purchase.supplier.phone && (
              <div>
                <p className="text-xs text-muted mb-1">هاتف المورد</p>
                <p dir="ltr" className="text-left">
                  {purchase.supplier.phone}
                </p>
              </div>
            )}
          </div>
          {userNotes && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted mb-1">ملاحظات</p>
              <p className="text-sm text-muted whitespace-pre-wrap">{userNotes}</p>
            </div>
          )}
          {expenseLine && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-accent-orange mb-1">مصاريف الفاتورة</p>
              <p className="text-sm text-accent-orange/90">{expenseLine.replace("مصاريف الفاتورة:", "").trim()}</p>
            </div>
          )}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-white">الإجماليات</h2>
          <div className="space-y-2 text-sm">
            {hasExpenses ? (
              <>
                <div className="flex justify-between text-muted">
                  <span>إجمالي الأصناف قبل المصروف</span>
                  <span className="tabular-nums">{formatCurrency(subtotalBefore)} ج.م</span>
                </div>
                <div className="flex justify-between text-accent-orange">
                  <span>مصاريف الفاتورة</span>
                  <span className="tabular-nums">+ {formatCurrency(expenseAmount)} ج.م</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>إجمالي الأصناف بعد المصروف</span>
                  <span className="tabular-nums">{formatCurrency(subtotalAfter)} ج.م</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-muted">
                <span>إجمالي الأصناف</span>
                <span className="tabular-nums">{formatCurrency(purchase.subtotal)} ج.م</span>
              </div>
            )}
            {purchase.discount > 0 && (
              <div className="flex justify-between text-muted">
                <span>الخصم</span>
                <span className="tabular-nums">- {formatCurrency(purchase.discount)} ج.م</span>
              </div>
            )}
            {purchase.taxAmount > 0 && (
              <div className="flex justify-between text-muted">
                <span>الضريبة ({purchase.taxRate}%)</span>
                <span className="tabular-nums">{formatCurrency(purchase.taxAmount)} ج.م</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-accent-green pt-2 border-t border-border">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(purchase.total)} ج.م</span>
            </div>
            {purchase.paymentType && purchase.paymentType !== "full_cash" && (
              <>
                <div className="flex justify-between text-sm text-muted pt-2">
                  <span>نوع الدفع</span>
                  <span>{paymentTypeLabels[purchase.paymentType] || purchase.paymentType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">المسدّد</span>
                  <span className="tabular-nums text-accent-green">
                    {formatCurrency(purchase.paidAmount ?? 0)} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">المتبقي (أجل)</span>
                  <span className="tabular-nums text-accent-orange font-bold">
                    {formatCurrency(purchase.creditOutstanding ?? 0)} ج.م
                  </span>
                </div>
              </>
            )}
            {purchase.paymentType === "full_cash" && purchase.cashSource && (
              <div className="flex justify-between text-sm text-muted pt-2">
                <span>مصدر الدفع</span>
                <span>{cashSourceLabels[purchase.cashSource] || purchase.cashSource}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <PurchaseInvoiceLinesTable
        rows={tableRows}
        invoiceNumber={purchase.invoiceNumber}
        hasExpenses={hasExpenses}
        readOnly
      />

      {returns.length > 0 && (
        <div className="glass-card p-5 mt-5 space-y-4">
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
                  <div className="text-left">
                    <p className="text-xs text-muted">مبلغ المرتجع</p>
                    <p className="font-bold text-accent-green tabular-nums">
                      {formatCurrency(ret.total)} ج.م
                    </p>
                  </div>
                </div>

                {ret.expenseHandling && (
                  <p className="text-xs text-accent-orange">
                    المصروف: {ret.expenseHandling}
                    {ret.expenseRecoveredAmount > 0.001
                      ? ` — مسترد ${formatCurrency(ret.expenseRecoveredAmount)} ج.م`
                      : ""}
                  </p>
                )}

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
                            {item.imeisSnapshot && (
                              <p className="text-[11px] text-muted-dark mt-0.5">
                                IMEI: {formatStoredDeviceImeis(item.imeisSnapshot)}
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
      <PurchaseBarcodePrintModal
        open={barcodeModalOpen}
        items={purchase.items}
        invoiceNumber={purchase.invoiceNumber}
        onClose={() => setBarcodeModalOpen(false)}
      />
    </>
  );
}
