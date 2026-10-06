"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FileDown, Share2 } from "lucide-react";

import SaleInvoicePrintSwitch from "@/components/print/SaleInvoicePrintSwitch";
import { apiJson } from "@/lib/api-client";
import { invoiceCreatorAccountName } from "@/lib/invoice-creator";
import {
  DEFAULT_PRINT_SETTINGS,
  normalizePrintSettings,
  type PrintSettings,
  type SaleInvoicePrintData,
} from "@/lib/print-settings";
import {
  printInvoiceFromContainer,
  prepareInvoicePdfFromContainer,
  sharePreparedInvoiceFile,
} from "@/lib/print-utils";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";

interface SaleApiItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imei: string | null;
  barcode: string | null;
  phoneDisplay?: {
    deviceCondition: string;
    taxStatus: string;
    boxCondition: string | null;
    deviceConditionLabel: string;
    color: string | null;
    storage: string | null;
    taxStatusLabel: string;
    batteryPercent: number | null;
    boxConditionLabel: string | null;
  } | null;
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
    servedByName?: string | null;
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
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preparingShare, setPreparingShare] = useState(false);
  const [shareReady, setShareReady] = useState(false);
  const preparedPdfRef = useRef<File | null>(null);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      apiJson<SaleApiResponse>(`/api/sales/${id}`),
      fetch("/api/settings/print", { credentials: "include" }).then((response) => response.json()),
      fetch("/api/settings/company", { credentials: "include" }).then((response) => response.json()),
    ]).then(([saleResult, settingsResult, companyResult]) => {
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
          servedByName: currentSale.servedByName ?? null,
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
        setSettings(normalizePrintSettings(settingsResult.settings));
      }
      if (companyResult.company?.logoUrl) {
        setCompanyLogoUrl(companyResult.company.logoUrl);
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
      companyLogoUrl,
      branchName: selectedBranch?.name,
      branchAddress: selectedBranch?.address,
      branchPhone: selectedBranch?.phone,
      invoiceCreatorName,
    }),
    [user, selectedBranch, invoiceCreatorName, companyLogoUrl]
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
          {shareReady ? (
            <button
              type="button"
              onClick={() => {
                const file = preparedPdfRef.current;
                if (!file) return;
                void sharePreparedInvoiceFile(file, sale.invoiceNumber).then((result) => {
                  if (result === "downloaded") {
                    toast.info("تم تنزيل ملف الفاتورة — يمكنك مشاركته من الملفات");
                  }
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 border border-emerald-500/35 text-emerald-300"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              مشاركة الفاتورة
            </button>
          ) : (
            <button
              type="button"
              disabled={preparingShare}
              onClick={() => {
                setPreparingShare(true);
                void prepareInvoicePdfFromContainer(printRef.current, sale.invoiceNumber)
                  .then((file) => {
                    preparedPdfRef.current = file;
                    setShareReady(true);
                    toast.success("تم تجهيز الفاتورة — اضغط مشاركة الفاتورة");
                  })
                  .catch(() => {
                    toast.error("تعذر تجهيز ملف الفاتورة للمشاركة");
                  })
                  .finally(() => setPreparingShare(false));
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" aria-hidden />
              {preparingShare ? "جاري التجهيز..." : "تجهيز الفاتورة للمشاركة"}
            </button>
          )}
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
        <SaleInvoicePrintSwitch sale={sale} context={context} settings={settings} />
      </div>
    </div>
  );
}
