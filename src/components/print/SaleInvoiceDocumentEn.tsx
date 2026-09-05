"use client";

import { useEffect, useRef, useState } from "react";

import InvoiceBarcode from "@/components/print/InvoiceBarcode";
import InvoiceContactFooter from "@/components/print/InvoiceContactFooter";
import { formatCurrency } from "@/lib/utils";
import { formatStoredDeviceImeis } from "@/lib/product-serial-imeis";
import {
  boxConditionLabelEn,
  deviceConditionLabelEn,
  taxStatusLabelEn,
} from "@/lib/phone-device-display-en";
import {
  getInvoiceTableStyleVars,
  hasInvoiceContactFooterContent,
  PAYMENT_METHOD_LABELS_EN,
  resolveEnglishInvoiceFooterText,
  resolveEnglishInvoiceSubtitle,
  type PrintSettings,
  type SaleInvoicePrintContext,
  type SaleInvoicePrintData,
} from "@/lib/print-settings";
import "@/styles/print-invoice.css";

interface SaleInvoiceDocumentEnProps {
  sale: SaleInvoicePrintData;
  context: SaleInvoicePrintContext;
  settings: PrintSettings;
  className?: string;
}

function formatSaleDateEn(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-GB"),
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

function formatMoney(value: number) {
  return `${formatCurrency(value)} EGP`;
}

function InvoicePhoneMetaEn({
  phone,
}: {
  phone: NonNullable<SaleInvoicePrintData["items"][number]["phoneDisplay"]>;
}) {
  const parts = [
    `Condition: ${deviceConditionLabelEn(phone.deviceCondition)}`,
    ...(phone.storage ? [`Storage: ${phone.storage}`] : []),
    ...(phone.color ? [`Color: ${phone.color}`] : []),
    `Tax: ${taxStatusLabelEn(phone.taxStatus)}`,
    ...(phone.batteryPercent != null ? [`Battery: ${phone.batteryPercent}%`] : []),
    ...(phone.boxCondition
      ? (() => {
          const label = boxConditionLabelEn(phone.boxCondition);
          return label ? [label] : [];
        })()
      : []),
  ];

  return (
    <div className="invoice-print-item-meta invoice-print-phone-meta">
      {parts.map((part, index) => (
        <span key={`phone-meta-en-${index}`}>
          {index > 0 ? (
            <>
              {"  "}
              <span className="invoice-print-phone-meta-sep">,</span>
              {"  "}
            </>
          ) : null}
          {part}
        </span>
      ))}
    </div>
  );
}

function InvoiceItemsTableEn({
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
            <th>#</th>
            <th>{variant === "thermal" ? "Item" : "Item / Description"}</th>
            <th>Qty</th>
            {variant === "sheet" ? <th>Price</th> : null}
            <th>Total</th>
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
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </div>
                ) : null}
                {item.imei ? (
                  <div className="invoice-print-item-meta">
                    IMEI: {formatStoredDeviceImeis(item.imei)}
                  </div>
                ) : null}
                {item.phoneDisplay ? <InvoicePhoneMetaEn phone={item.phoneDisplay} /> : null}
                {!item.imei && item.barcode ? (
                  <div className="invoice-print-item-meta">Barcode: {item.barcode}</div>
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

function SheetTotalsBlockEn({ sale }: { sale: SaleInvoicePrintData }) {
  return (
    <div className="invoice-print-totals invoice-print-totals--sheet">
      <div className="invoice-print-total-row">
        <span>Subtotal</span>
        <span className="invoice-print-total-badge">{formatMoney(sale.subtotal)}</span>
      </div>
      <div className="invoice-print-total-row">
        <span>Discount</span>
        <span className="invoice-print-total-badge invoice-print-total-badge--discount">
          {sale.discount > 0 ? `- ${formatCurrency(sale.discount)}` : formatCurrency(0)} EGP
        </span>
      </div>
      <div className="invoice-print-total-row">
        <span>{sale.taxAmount > 0 ? `Tax (${sale.taxRate}%)` : "Tax"}</span>
        <span className="invoice-print-total-badge invoice-print-total-badge--tax">
          {sale.taxAmount > 0 ? formatMoney(sale.taxAmount) : formatMoney(0)}
        </span>
      </div>
      <div className="invoice-print-total-row">
        <span>Net total</span>
        <span className="invoice-print-total-badge invoice-print-total-badge--net">
          {formatMoney(sale.total)}
        </span>
      </div>
    </div>
  );
}

function ThermalTotalsBlockEn({ sale }: { sale: SaleInvoicePrintData }) {
  return (
    <div className="invoice-print-totals invoice-print-totals--thermal">
      <div className="invoice-print-thermal-total-line">
        <span>Subtotal</span>
        <strong>{formatMoney(sale.subtotal)}</strong>
      </div>
      <div className="invoice-print-thermal-total-line">
        <span>Discount</span>
        <strong>
          {sale.discount > 0 ? `- ${formatCurrency(sale.discount)}` : formatCurrency(0)} EGP
        </strong>
      </div>
      <div className="invoice-print-thermal-total-line">
        <span>{sale.taxAmount > 0 ? `Tax (${sale.taxRate}%)` : "Tax"}</span>
        <strong>{sale.taxAmount > 0 ? formatMoney(sale.taxAmount) : formatMoney(0)}</strong>
      </div>
      <div className="invoice-print-thermal-total-line invoice-print-thermal-total-line--net">
        <span>Net</span>
        <strong>{formatMoney(sale.total)}</strong>
      </div>
    </div>
  );
}

function InvoiceBrandHeaderEn({
  headerTitle,
  companyLogoUrl,
  subtitle,
  branchName,
  branchPhone,
  branchAddress,
  variant,
}: {
  headerTitle: string;
  companyLogoUrl?: string | null;
  subtitle?: string;
  branchName?: string;
  branchPhone?: string | null;
  branchAddress?: string | null;
  variant: "sheet" | "thermal";
}) {
  const sheetTextRef = useRef<HTMLDivElement>(null);
  const [sheetTextHeight, setSheetTextHeight] = useState<number | null>(null);

  useEffect(() => {
    if (variant !== "sheet" || !companyLogoUrl) {
      setSheetTextHeight(null);
      return;
    }

    const node = sheetTextRef.current;
    if (!node) return;

    const syncHeight = () => {
      setSheetTextHeight(node.offsetHeight > 0 ? node.offsetHeight : null);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [variant, companyLogoUrl, headerTitle, subtitle, branchName, branchPhone, branchAddress]);

  const subtitleClass =
    variant === "thermal" ? "invoice-print-thermal-subtitle" : "invoice-print-brand-subtitle";

  if (variant === "thermal") {
    const thermalLogo = companyLogoUrl ? (
      <img
        src={companyLogoUrl}
        alt={headerTitle}
        className="invoice-print-brand-logo invoice-print-brand-logo--thermal"
      />
    ) : null;

    return (
      <header className="invoice-print-thermal-header">
        {thermalLogo}
        <h1 className="invoice-print-thermal-title">{headerTitle}</h1>
        {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
        {branchName ? <p className={subtitleClass}>{branchName}</p> : null}
        {branchPhone ? (
          <p className="invoice-print-thermal-branch">Branch phone: {branchPhone}</p>
        ) : null}
        {branchAddress ? <p className="invoice-print-thermal-branch">{branchAddress}</p> : null}
      </header>
    );
  }

  const sheetLogo = companyLogoUrl ? (
    <div
      className="invoice-print-brand-logo-wrap"
      style={sheetTextHeight ? { height: sheetTextHeight } : undefined}
    >
      <img
        src={companyLogoUrl}
        alt={headerTitle}
        className="invoice-print-brand-logo"
        style={sheetTextHeight ? { height: sheetTextHeight } : undefined}
      />
    </div>
  ) : null;

  return (
    <div className="invoice-print-brand-block">
      {sheetLogo}
      <div ref={sheetTextRef} className="invoice-print-brand-text">
        <h1 className="invoice-print-brand-title">{headerTitle}</h1>
        {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
        {branchName ? <p className={subtitleClass}>{branchName}</p> : null}
        {branchPhone ? <p className={subtitleClass}>Branch phone: {branchPhone}</p> : null}
        {branchAddress ? <p className={subtitleClass}>{branchAddress}</p> : null}
      </div>
    </div>
  );
}

function SheetInvoiceBodyEn({
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
        <InvoiceBrandHeaderEn
          variant="sheet"
          headerTitle={headerTitle}
          companyLogoUrl={context.companyLogoUrl}
          subtitle={resolveEnglishInvoiceSubtitle(settings)}
          branchName={context.branchName}
          branchPhone={settings.showBranchPhoneOnInvoice ? context.branchPhone : null}
          branchAddress={settings.showBranchAddressOnInvoice ? context.branchAddress : null}
        />

        <div className="invoice-print-meta-box">
          <p className="invoice-print-meta-title">Payment receipt</p>
          {settings.showInvoiceNumberOnInvoice ? (
            <div className="invoice-print-meta-row">
              <span>No.</span>
              <strong>{sale.invoiceNumber}</strong>
            </div>
          ) : null}
          <div className="invoice-print-meta-row">
            <span>Date</span>
            <strong>{date}</strong>
          </div>
          <div className="invoice-print-meta-row">
            <span>Time</span>
            <strong>{time}</strong>
          </div>
          <div className="invoice-print-meta-row">
            <span>Payment</span>
            <strong>{paymentLabel}</strong>
          </div>
        </div>
      </header>

      <hr className="invoice-print-divider" />

      <section className="invoice-print-info-panel">
        <div className="invoice-print-info-block">
          <p className="invoice-print-info-label">Invoice barcode</p>
          <div className="invoice-print-barcode-wrap">
            <InvoiceBarcode value={sale.invoiceNumber} />
          </div>
          {settings.showInvoiceCreatorOnInvoice && context.invoiceCreatorName ? (
            <p className="invoice-print-info-sub">Account: {context.invoiceCreatorName}</p>
          ) : null}
        </div>

        <div className="invoice-print-info-block">
          <p className="invoice-print-info-label">Customer</p>
          <p className="invoice-print-info-value">{sale.customer?.nameAr || "Walk-in customer"}</p>
          {sale.customer?.phone ? (
            <p className="invoice-print-info-sub">{sale.customer.phone}</p>
          ) : null}
        </div>
      </section>

      <InvoiceItemsTableEn sale={sale} variant="sheet" />
      <SheetTotalsBlockEn sale={sale} />
    </>
  );
}

function ThermalInvoiceBodyEn({
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
      <InvoiceBrandHeaderEn
        variant="thermal"
        headerTitle={headerTitle}
        companyLogoUrl={context.companyLogoUrl}
        subtitle={resolveEnglishInvoiceSubtitle(settings)}
        branchName={context.branchName}
        branchPhone={settings.showBranchPhoneOnInvoice ? context.branchPhone : null}
        branchAddress={settings.showBranchAddressOnInvoice ? context.branchAddress : null}
      />

      <div className="invoice-print-thermal-rule" />

      <section className="invoice-print-thermal-meta">
        {settings.showInvoiceNumberOnInvoice ? (
          <div className="invoice-print-thermal-meta-row">
            <span>Invoice No.</span>
            <strong>{sale.invoiceNumber}</strong>
          </div>
        ) : null}
        <div className="invoice-print-thermal-meta-row">
          <span>Date</span>
          <strong>{date}</strong>
        </div>
        <div className="invoice-print-thermal-meta-row">
          <span>Time</span>
          <strong>{time}</strong>
        </div>
        <div className="invoice-print-thermal-meta-row">
          <span>Payment</span>
          <strong>{paymentLabel}</strong>
        </div>
      </section>

      <div className="invoice-print-thermal-rule" />

      <section className="invoice-print-thermal-customer">
        <p className="invoice-print-thermal-label">Customer</p>
        <p className="invoice-print-thermal-customer-name">
          {sale.customer?.nameAr || "Walk-in customer"}
        </p>
        {sale.customer?.phone ? (
          <p className="invoice-print-thermal-customer-phone">{sale.customer.phone}</p>
        ) : null}
        {settings.showInvoiceCreatorOnInvoice && context.invoiceCreatorName ? (
          <p className="invoice-print-thermal-customer-phone">
            Account: {context.invoiceCreatorName}
          </p>
        ) : null}
      </section>

      <div className="invoice-print-thermal-barcode">
        <InvoiceBarcode value={sale.invoiceNumber} compact />
      </div>

      <div className="invoice-print-thermal-rule" />

      <InvoiceItemsTableEn sale={sale} variant="thermal" />
      <ThermalTotalsBlockEn sale={sale} />

      <div className="invoice-print-thermal-rule" />
    </>
  );
}

export default function SaleInvoiceDocumentEn({
  sale,
  context,
  settings,
  className,
}: SaleInvoiceDocumentEnProps) {
  const isThermal = settings.paperSize !== "a4" && settings.paperSize !== "b5";
  const { date, time } = formatSaleDateEn(sale.saleDate);
  const headerTitle = settings.headerTitle.trim() || context.companyName;
  const paymentLabel = PAYMENT_METHOD_LABELS_EN[sale.paymentMethod] || sale.paymentMethod;
  const fontSize = isThermal ? settings.thermalFontSize : settings.sheetFontSize;
  const tableStyleVars = getInvoiceTableStyleVars(settings, isThermal);
  const footerText = resolveEnglishInvoiceFooterText(settings);
  const hasSheetPageFooter =
    hasInvoiceContactFooterContent(settings) || Boolean(footerText);

  return (
    <div
      className={`invoice-print-page invoice-print-page--en ${className ?? ""}`.trim()}
      dir="ltr"
      lang="en"
      data-paper={settings.paperSize}
      data-layout={isThermal ? "thermal" : "sheet"}
      style={{
        ["--invoice-font-size" as string]: `${fontSize}px`,
        ...tableStyleVars,
      }}
    >
      <article
        className={`invoice-print-shell invoice-print-shell--en ${
          isThermal ? "invoice-print-shell--thermal" : "invoice-print-shell--sheet"
        }`}
      >
        {isThermal ? (
          <>
            <ThermalInvoiceBodyEn
              sale={sale}
              context={context}
              settings={settings}
              headerTitle={headerTitle}
              paymentLabel={paymentLabel}
              date={date}
              time={time}
            />

            {sale.notes ? <div className="invoice-print-notes">Notes: {sale.notes}</div> : null}

            <InvoiceContactFooter settings={settings} variant="thermal" />

            {footerText ? (
              <footer className="invoice-print-thermal-footer">{footerText}</footer>
            ) : null}
          </>
        ) : (
          <>
            <div className="invoice-print-sheet-body">
              <SheetInvoiceBodyEn
                sale={sale}
                context={context}
                settings={settings}
                headerTitle={headerTitle}
                paymentLabel={paymentLabel}
                date={date}
                time={time}
              />

              {sale.notes ? <div className="invoice-print-notes">Notes: {sale.notes}</div> : null}
            </div>

            {hasSheetPageFooter ? (
              <div className="invoice-print-sheet-page-footer">
                <InvoiceContactFooter settings={settings} variant="sheet" />

                {footerText ? (
                  <footer className="invoice-print-footer">{footerText}</footer>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </article>
    </div>
  );
}
