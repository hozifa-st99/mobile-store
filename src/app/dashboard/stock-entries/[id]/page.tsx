"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import PurchaseInvoiceLinesTable from "@/components/purchases/PurchaseInvoiceLinesTable";
import type { InvoiceLineRow } from "@/lib/purchase-line-display";
import { parseImeisSnapshot } from "@/lib/purchase-return-number";
import { formatCurrency } from "@/lib/utils";
import { apiJson } from "@/lib/api-client";

interface StockEntryItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  retailPrice: number;
  total: number;
  barcode: string | null;
  deviceCondition: string;
  boxCondition: string | null;
  batteryPercent: number | null;
  itemNotes: string | null;
  imeisSnapshot: string | null;
}

interface StockEntryDetail {
  id: string;
  documentNumber: string;
  entryDate: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string | null;
  items: StockEntryItem[];
}

function conditionLabel(item: StockEntryItem): string {
  if (item.deviceCondition === "used") {
    const parts = ["مستعمل"];
    if (item.batteryPercent != null) parts.push(`بطارية ${item.batteryPercent}%`);
    if (item.boxCondition === "excellent") parts.push("كارتونة ممتازة");
    else if (item.boxCondition === "medium") parts.push("كارتونة متوسطة");
    else if (item.boxCondition === "missing") parts.push("بدون كارتونة");
    return parts.join(" · ");
  }
  return "جديد";
}

function buildStockEntryItemRows(items: StockEntryItem[]): InvoiceLineRow[] {
  return items.map((item) => {
    const name = item.description.split(" · ")[0]?.trim() || item.description;
    const detailsParts = item.description.split(" · ").slice(1);
    const imeis = parseImeisSnapshot(item.imeisSnapshot);
    const extraDetails = [
      ...detailsParts,
      imeis.length > 0 ? `IMEI: ${imeis.join(" / ")}` : null,
      item.barcode ? `باركود: ${item.barcode}` : null,
      item.itemNotes?.trim() || null,
    ].filter(Boolean);

    return {
      id: item.id,
      type: imeis.length > 0 ? "phone" : "accessory",
      typeLabel: imeis.length > 0 ? "موبايل" : "صنف",
      name,
      details: extraDetails.join(" · ") || "—",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      retailPrice: item.retailPrice,
      total: item.total,
      barcode: item.barcode || "—",
      imeis,
      condition: conditionLabel(item),
    };
  });
}

export default function StockEntryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [entry, setEntry] = useState<StockEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiJson<{ entry?: StockEntryDetail; message?: string }>(`/api/stock-entries/${id}`).then(
      ({ ok, data }) => {
        if (ok && data.entry) {
          setEntry(data.entry);
        } else {
          setError(data.message || "تعذر تحميل المستند");
        }
        setLoading(false);
      }
    );
  }, [id]);

  const tableRows = useMemo(
    () => (entry ? buildStockEntryItemRows(entry.items) : []),
    [entry]
  );

  if (loading) {
    return (
      <>
        <PageHeader title="مستند إدخال رصيد" subtitle="جاري التحميل..." />
        <div className="glass-card p-12 text-center text-muted">جاري التحميل...</div>
      </>
    );
  }

  if (error || !entry) {
    return (
      <>
        <PageHeader title="مستند إدخال رصيد" subtitle="خطأ" />
        <div className="glass-card p-12 text-center space-y-4">
          <p className="text-red-400">{error || "المستند غير موجود"}</p>
          <Link
            href="/dashboard/documents"
            className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/20 border border-primary/40 text-primary-light"
          >
            ← العودة للمستندات
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="مستند إدخال رصيد"
        subtitle={`${entry.documentNumber} · ${new Date(entry.entryDate).toLocaleDateString("ar-EG")}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/documents"
          className="inline-flex text-sm text-muted hover:text-primary-light transition-colors"
        >
          ← العودة للمستندات
        </Link>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          رصيد افتتاحي
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="glass-card p-5 lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-white">بيانات المستند</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted mb-1">رقم المستند</p>
              <p className="font-semibold text-primary-light">{entry.documentNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">التاريخ</p>
              <p>{new Date(entry.entryDate).toLocaleDateString("ar-EG")}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">الحالة</p>
              <span className="status-complete">مكتمل</span>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">النوع</p>
              <span className="text-cyan-300">رصيد افتتاحي / موجود مسبقاً</span>
            </div>
          </div>
          {entry.notes && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted mb-1">ملاحظات</p>
              <p className="text-sm text-muted whitespace-pre-wrap">{entry.notes}</p>
            </div>
          )}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-white">الإجماليات</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>إجمالي الأصناف</span>
              <span className="tabular-nums">{formatCurrency(entry.subtotal)} ج.م</span>
            </div>
            <div className="flex justify-between text-base font-bold text-accent-green pt-2 border-t border-border">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(entry.total)} ج.م</span>
            </div>
          </div>
        </div>
      </div>

      <PurchaseInvoiceLinesTable
        rows={tableRows}
        invoiceNumber={entry.documentNumber}
        readOnly
      />
    </>
  );
}
