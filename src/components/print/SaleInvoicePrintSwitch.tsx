"use client";

import SaleInvoiceDocument from "@/components/print/SaleInvoiceDocument";
import SaleInvoiceDocumentEn from "@/components/print/SaleInvoiceDocumentEn";
import type { PrintSettings, SaleInvoicePrintContext, SaleInvoicePrintData } from "@/lib/print-settings";

interface SaleInvoicePrintSwitchProps {
  sale: SaleInvoicePrintData;
  context: SaleInvoicePrintContext;
  settings: PrintSettings;
  className?: string;
}

/** يختار قالب العربي (بدون تغيير) أو الإنجليزي حسب إعدادات الطباعة — عرض فقط */
export default function SaleInvoicePrintSwitch({
  sale,
  context,
  settings,
  className,
}: SaleInvoicePrintSwitchProps) {
  if (settings.invoiceLanguage === "en") {
    return (
      <SaleInvoiceDocumentEn
        sale={sale}
        context={context}
        settings={settings}
        className={className}
      />
    );
  }

  return (
    <SaleInvoiceDocument sale={sale} context={context} settings={settings} className={className} />
  );
}
