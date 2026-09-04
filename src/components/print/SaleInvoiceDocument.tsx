"use client";

import InvoiceBarcode from "@/components/print/InvoiceBarcode";
import { formatCurrency } from "@/lib/utils";
import { formatStoredDeviceImeis } from "@/lib/product-serial-imeis";
import {
  getInvoiceTableStyleVars,
  PAYMENT_METHOD_LABELS,
  type PrintSettings,
  type SaleInvoicePrintContext,
  type SaleInvoicePrintData,
} from "@/lib/print-settings";
import "@/styles/print-invoice.css";

interface SaleInvoiceDocumentProps {
  sale: SaleInvoicePrintData;
  context: SaleInvoicePrintContext;
  settings: PrintSettings;
  className?: string;
}

function formatSaleDate(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("ar-EG"),
    time: date.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
  };
}

function InvoiceItemsTable({
  sale,
  variant,
}: {
  sale: SaleInvoicePrintData;
  variant: "thermal" | "sheet";
}) {
  return (
    <div className={`invoice-print-table-wrap invoice-print-table-wrap--${variant}`}>
      <table className={`invoice-print-table invoice-print-table--${variant}`}>
        <thead>
          <tr>
            <th>م</th>
            <th>{variant === "thermal" ? "الصنف" : "الصنف / البيان"}</th>
            <th>الكمية</th>
            {variant === "sheet" ? <th>السعر</th> : null}
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => (
            <tr key={`${item.description}-${index}`}>
              <td>{index + 1}</td>
              <td>
                <div>{item.description}</div>
                {variant === "thermal" ? (
                  <div className="invoice-print-item-meta">
                    {item.quantity} × {formatCurrency(item.unitPrice)} ج.م
                  </div>
                ) : null}
                {item.imei ? (
                  <div className="invoice-print-item-meta">
                    IMEI: {formatStoredDeviceImeis(item.imei)}
                  </div>
                ) : null}
                {!item.imei && item.barcode ? (
                  <div className="invoice-print-item-meta">باركود: {item.barcode}</div>
                ) : null}
              </td>
              <td>{item.quantity}</td>
              {variant === "sheet" ? <td>{formatCurrency(item.unitPrice)}</td> : null}
              <td>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SheetTotalsBlock({ sale }: { sale: SaleInvoicePrintData }) {
  return (
    <div className="invoice-print-totals invoice-print-totals--sheet">
      <div className="invoice-print-total-row">
        <span>الإجمالي</span>
        <span className="invoice-print-total-badge">{formatCurrency(sale.subtotal)} ج.م</span>
      </div>
      <div className="invoice-print-total-row">
        <span>الخصم</span>
        <span className="invoice-print-total-badge invoice-print-total-badge--discount">
          {sale.discount > 0 ? `- ${formatCurrency(sale.discount)}` : formatCurrency(0)} ج.م
        </span>
      </div>
      <div className="invoice-print-total-row">
        <span>{sale.taxAmount > 0 ? `الضريبة (${sale.taxRate}%)` : "الضريبة"}</span>
        <span className="invoice-print-total-badge invoice-print-total-badge--tax">
          {sale.taxAmount > 0 ? `${formatCurrency(sale.taxAmount)}` : formatCurrency(0)} ج.م
        </span>
      </div>
      <div className="invoice-print-total-row">
        <span>الصافي النهائي</span>
        <span className="invoice-print-total-badge invoice-print-total-badge--net">
          {formatCurrency(sale.total)} ج.م
        </span>
      </div>
    </div>
  );
}

function ThermalTotalsBlock({ sale }: { sale: SaleInvoicePrintData }) {
  return (
    <div className="invoice-print-totals invoice-print-totals--thermal">
      <div className="invoice-print-thermal-total-line">
        <span>الإجمالي</span>
        <strong>{formatCurrency(sale.subtotal)} ج.م</strong>
      </div>
      <div className="invoice-print-thermal-total-line">
        <span>الخصم</span>
        <strong>{sale.discount > 0 ? `- ${formatCurrency(sale.discount)}` : formatCurrency(0)} ج.م</strong>
      </div>
      <div className="invoice-print-thermal-total-line">
        <span>{sale.taxAmount > 0 ? `الضريبة (${sale.taxRate}%)` : "الضريبة"}</span>
        <strong>{sale.taxAmount > 0 ? `${formatCurrency(sale.taxAmount)}` : formatCurrency(0)} ج.م</strong>
      </div>
      <div className="invoice-print-thermal-total-line invoice-print-thermal-total-line--net">
        <span>الصافي</span>
        <strong>{formatCurrency(sale.total)} ج.م</strong>
      </div>
    </div>
  );
}

function InvoiceBrandHeader({
  headerTitle,
  companyLogoUrl,
  subtitle,
  branchName,
  variant,
}: {
  headerTitle: string;
  companyLogoUrl?: string | null;
  subtitle?: string;
  branchName?: string;
  variant: "sheet" | "thermal";
}) {
  const logo =
    companyLogoUrl ? (
      <img
        src={companyLogoUrl}
        alt={headerTitle}
        className={
          variant === "thermal"
            ? "invoice-print-brand-logo invoice-print-brand-logo--thermal"
            : "invoice-print-brand-logo"
        }
      />
    ) : null;

  if (variant === "thermal") {
    return (
      <header className="invoice-print-thermal-header">
        {logo}
        <h1 className="invoice-print-thermal-title">{headerTitle}</h1>
        {subtitle ? <p className="invoice-print-thermal-subtitle">{subtitle}</p> : null}
        {branchName ? <p className="invoice-print-thermal-subtitle">{branchName}</p> : null}
      </header>
    );
  }

  return (
    <div className="invoice-print-brand-block">
      {logo}
      <div>
        <h1 className="invoice-print-brand-title">{headerTitle}</h1>
        {subtitle ? <p className="invoice-print-brand-subtitle">{subtitle}</p> : null}
        {branchName ? <p className="invoice-print-brand-subtitle">{branchName}</p> : null}
      </div>
    </div>
  );
}

function SheetInvoiceBody({
  sale,
  context,
  settings,
  headerTitle,
  paymentLabel,
  date,
  time,
}: {
  sale: SaleInvoicePrintData;
  context: SaleInvoicePrintContext;
  settings: PrintSettings;
  headerTitle: string;
  paymentLabel: string;
  date: string;
  time: string;
}) {
  return (
    <>
      <header className="invoice-print-header">
        <InvoiceBrandHeader
          variant="sheet"
          headerTitle={headerTitle}
          companyLogoUrl={context.companyLogoUrl}
          subtitle={settings.headerSubtitle}
          branchName={context.branchName}
        />

        <div className="invoice-print-meta-box">
          <p className="invoice-print-meta-title">إيصال دفع</p>
          {settings.showInvoiceNumberOnInvoice ? (
            <div className="invoice-print-meta-row">
              <span>رقم</span>
              <strong>{sale.invoiceNumber}</strong>
            </div>
          ) : null}
          <div className="invoice-print-meta-row">
            <span>التاريخ</span>
            <strong>{date}</strong>
          </div>
          <div className="invoice-print-meta-row">
            <span>الوقت</span>
            <strong>{time}</strong>
          </div>
          <div className="invoice-print-meta-row">
            <span>الدفع</span>
            <strong>{paymentLabel}</strong>
          </div>
        </div>
      </header>

      <hr className="invoice-print-divider" />

      <section className="invoice-print-info-panel">
        <div className="invoice-print-info-block">
          <p className="invoice-print-info-label">باركود الفاتورة</p>
          <div className="invoice-print-barcode-wrap">
            <InvoiceBarcode value={sale.invoiceNumber} />
          </div>
          {settings.showInvoiceCreatorOnInvoice && context.invoiceCreatorName ? (
            <p className="invoice-print-info-sub">الحساب: {context.invoiceCreatorName}</p>
          ) : null}
        </div>

        <div className="invoice-print-info-block">
          <p className="invoice-print-info-label">بيانات العميل</p>
          <p className="invoice-print-info-value">{sale.customer?.nameAr || "عميل نقدي"}</p>
          {sale.customer?.phone ? (
            <p className="invoice-print-info-sub">{sale.customer.phone}</p>
          ) : null}
          {settings.showBranchPhoneOnInvoice && context.branchPhone ? (
            <p className="invoice-print-info-sub">هاتف الفرع: {context.branchPhone}</p>
          ) : null}
          {settings.showBranchAddressOnInvoice && context.branchAddress ? (
            <p className="invoice-print-info-sub">{context.branchAddress}</p>
          ) : null}
        </div>
      </section>

      <InvoiceItemsTable sale={sale} variant="sheet" />
      <SheetTotalsBlock sale={sale} />
    </>
  );
}

function ThermalInvoiceBody({
  sale,
  context,
  settings,
  headerTitle,
  paymentLabel,
  date,
  time,
}: {
  sale: SaleInvoicePrintData;
  context: SaleInvoicePrintContext;
  settings: PrintSettings;
  headerTitle: string;
  paymentLabel: string;
  date: string;
  time: string;
}) {
  return (
    <>
      <InvoiceBrandHeader
        variant="thermal"
        headerTitle={headerTitle}
        companyLogoUrl={context.companyLogoUrl}
        subtitle={settings.headerSubtitle}
        branchName={context.branchName}
      />

      <div className="invoice-print-thermal-rule" />

      <section className="invoice-print-thermal-meta">
        {settings.showInvoiceNumberOnInvoice ? (
          <div className="invoice-print-thermal-meta-row">
            <span>رقم الفاتورة</span>
            <strong>{sale.invoiceNumber}</strong>
          </div>
        ) : null}
        <div className="invoice-print-thermal-meta-row">
          <span>التاريخ</span>
          <strong>{date}</strong>
        </div>
        <div className="invoice-print-thermal-meta-row">
          <span>الوقت</span>
          <strong>{time}</strong>
        </div>
        <div className="invoice-print-thermal-meta-row">
          <span>طريقة الدفع</span>
          <strong>{paymentLabel}</strong>
        </div>
      </section>

      <div className="invoice-print-thermal-rule" />

      <section className="invoice-print-thermal-customer">
        <p className="invoice-print-thermal-label">العميل</p>
        <p className="invoice-print-thermal-customer-name">{sale.customer?.nameAr || "عميل نقدي"}</p>
        {sale.customer?.phone ? (
          <p className="invoice-print-thermal-customer-phone">{sale.customer.phone}</p>
        ) : null}
        {settings.showInvoiceCreatorOnInvoice && context.invoiceCreatorName ? (
          <p className="invoice-print-thermal-customer-phone">
            الحساب: {context.invoiceCreatorName}
          </p>
        ) : null}
      </section>

      <div className="invoice-print-thermal-barcode">
        <InvoiceBarcode value={sale.invoiceNumber} compact />
      </div>

      <div className="invoice-print-thermal-rule" />

      <InvoiceItemsTable sale={sale} variant="thermal" />
      <ThermalTotalsBlock sale={sale} />

      <div className="invoice-print-thermal-rule" />
    </>
  );
}

export default function SaleInvoiceDocument({
  sale,
  context,
  settings,
  className,
}: SaleInvoiceDocumentProps) {
  const isThermal = settings.paperSize !== "a4" && settings.paperSize !== "b5";
  const { date, time } = formatSaleDate(sale.saleDate);
  const headerTitle = settings.headerTitle.trim() || context.companyName;
  const paymentLabel = PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod;
  const fontSize = isThermal ? settings.thermalFontSize : settings.sheetFontSize;
  const tableStyleVars = getInvoiceTableStyleVars(settings, isThermal);

  return (
    <div
      className={`invoice-print-page ${className ?? ""}`.trim()}
      data-paper={settings.paperSize}
      data-layout={isThermal ? "thermal" : "sheet"}
      style={{
        ["--invoice-font-size" as string]: `${fontSize}px`,
        ...tableStyleVars,
      }}
    >
      <article
        className={`invoice-print-shell ${
          isThermal ? "invoice-print-shell--thermal" : "invoice-print-shell--sheet"
        }`}
      >
        {isThermal ? (
          <ThermalInvoiceBody
            sale={sale}
            context={context}
            settings={settings}
            headerTitle={headerTitle}
            paymentLabel={paymentLabel}
            date={date}
            time={time}
          />
        ) : (
          <SheetInvoiceBody
            sale={sale}
            context={context}
            settings={settings}
            headerTitle={headerTitle}
            paymentLabel={paymentLabel}
            date={date}
            time={time}
          />
        )}

        {sale.notes ? <div className="invoice-print-notes">ملاحظات: {sale.notes}</div> : null}

        {settings.footerText ? (
          <footer
            className={
              isThermal ? "invoice-print-thermal-footer" : "invoice-print-footer"
            }
          >
            {settings.footerText}
          </footer>
        ) : null}
      </article>
    </div>
  );
}
