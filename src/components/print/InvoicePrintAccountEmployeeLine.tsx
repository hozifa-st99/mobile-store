import type { PrintSettings } from "@/lib/print-settings";

const PRINT_ACCOUNT_EMPLOYEE_GAP = "\u00A0".repeat(7);

interface InvoicePrintAccountEmployeeLineProps {
  settings: PrintSettings;
  invoiceCreatorName?: string | null;
  servedByName?: string | null;
  accountLabel: string;
  employeeLabel: string;
  className?: string;
}

/** عرض فقط — حساب منشئ الفاتورة + موظف الفرع على الطباعة */
export default function InvoicePrintAccountEmployeeLine({
  settings,
  invoiceCreatorName,
  servedByName,
  accountLabel,
  employeeLabel,
  className = "invoice-print-info-sub",
}: InvoicePrintAccountEmployeeLineProps) {
  const showAccount = settings.showInvoiceCreatorOnInvoice && Boolean(invoiceCreatorName?.trim());
  const employeeName = servedByName?.trim() || null;
  const showEmployee = Boolean(employeeName);

  if (!showAccount && !showEmployee) return null;

  return (
    <p className={`invoice-print-account-employee-line ${className}`.trim()}>
      {showAccount ? (
        <>
          {accountLabel}: {invoiceCreatorName}
        </>
      ) : null}
      {showAccount && showEmployee ? PRINT_ACCOUNT_EMPLOYEE_GAP : null}
      {showEmployee ? (
        <>
          {employeeLabel}: {employeeName}
        </>
      ) : null}
    </p>
  );
}
