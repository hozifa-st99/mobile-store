"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import SaleInvoiceDocument from "@/components/print/SaleInvoiceDocument";
import { apiJson } from "@/lib/api-client";
import { invoiceCreatorAccountName } from "@/lib/invoice-creator";
import {
  DEFAULT_PRINT_SETTINGS,
  type PrintSettings,
  type SaleInvoicePrintData,
} from "@/lib/print-settings";
import { printInvoiceFromContainer } from "@/lib/print-utils";
import { useAuthStore } from "@/store/auth-store";

interface SaleApiItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imei: string | null;
  barcode: string | null;
}

interface SaleApiResponse {
  sale?: {
    invoiceNumber: string;
    saleDate: string;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    paidAmount?: number;
    notes: string | null;
    customer?: { nameAr: string; phone?: string | null } | null;
    createdBy?: { username: string; fullNameAr: string | null } | null;
    items: SaleApiItem[];
  };
  message?: string;
}

export default function SalePrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const autoCopies = Math.max(0, Number(searchParams.get("auto") || 0));
  const autoPrintStarted = useRef(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { user, selectedBranch } = useAuthStore();
  const [sale, setSale] = useState<SaleInvoicePrintData | null>(null);
  const [invoiceCreatorName, setInvoiceCreatorName] = useState<string | null>(null);
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    Promise.all([
      apiJson<SaleApiResponse>(`/api/sales/${id}`),
      fetch("/api/settings/print", { credentials: "include" }).then((response) => response.json()),
    ]).then(([saleResult, settingsResult]) => {
      if (saleResult.ok && saleResult.data.sale) {
        const currentSale = saleResult.data.sale;
        setSale({
          invoiceNumber: currentSale.invoiceNumber,
          saleDate: currentSale.saleDate,
          paymentMethod: currentSale.paymentMethod,
          subtotal: currentSale.subtotal,
          discount: currentSale.discount,
          taxRate: currentSale.taxRate,
          taxAmount: currentSale.taxAmount,
          total: currentSale.total,
          paidAmount: currentSale.paidAmount,
          notes: currentSale.notes,
          customer: currentSale.customer
            ? {
                nameAr: currentSale.customer.nameAr,
                phone: currentSale.customer.phone ?? null,
              }
            : null,
          items: currentSale.items,
        });
        setInvoiceCreatorName(invoiceCreatorAccountName(currentSale.createdBy));
      } else {
        setError(saleResult.data.message || "تعذر تحميل الفاتورة");
      }

      if (settingsResult.settings) {
        setSettings(settingsResult.settings);
      }

      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (loading || !sale || autoCopies <= 0 || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    const timer = window.setTimeout(() => {
      printInvoiceFromContainer(printRef.current, autoCopies);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [loading, sale, autoCopies]);

  const context = useMemo(
    () => ({
      companyName: user?.companyName || "المحل",
      branchName: selectedBranch?.name,
      branchAddress: selectedBranch?.address,
      branchPhone: selectedBranch?.phone,
      invoiceCreatorName,
    }),
    [user, selectedBranch, invoiceCreatorName]
  );

  if (loading) {
    return (
      <div className="glass-card p-12 text-center text-muted no-print">جاري تحضير الفاتورة للطباعة...</div>
    );
  }

  if (error || !sale) {
    return (
      <div className="glass-card p-12 text-center space-y-4 no-print">
        <p className="text-red-400">{error || "الفاتورة غير موجودة"}</p>
        <Link
          href="/dashboard/sales"
          className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/20 border border-primary/40 text-primary-light"
        >
          ← العودة للقائمة
        </Link>
      </div>
    );
  }

  return (
    <div className="invoice-print-root">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-bold text-white">طباعة فاتورة {sale.invoiceNumber}</h1>
          <p className="text-sm text-muted">معاينة قبل الطباعة على {settings.paperSize.toUpperCase()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/sales/${id}`}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/10 border border-border text-white"
          >
            ← رجوع
          </Link>
          <button
            type="button"
            onClick={() => printInvoiceFromContainer(printRef.current)}
            className="btn-primary"
          >
            طباعة
          </button>
        </div>
      </div>

      <div ref={printRef} className="invoice-print-viewport bg-white">
        <SaleInvoiceDocument sale={sale} context={context} settings={settings} />
      </div>
    </div>
  );
}
