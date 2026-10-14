"use client";

import InvoiceBarcode from "@/components/print/InvoiceBarcode";
import {
  formatBarcodePhoneMeta,
  getBarcodeLabelMeta,
  getBarcodeRenderOptions,
  type BarcodeLabelItem,
  type BarcodePrintSettings,
} from "@/lib/barcode-print-settings";
import { formatCurrency } from "@/lib/utils";
import "@/styles/print-barcode.css";

interface BarcodeLabelsDocumentProps {
  settings: BarcodePrintSettings;
  labels: BarcodeLabelItem[];
  preview?: boolean;
}

export default function BarcodeLabelsDocument({
  settings,
  labels,
  preview = false,
}: BarcodeLabelsDocumentProps) {
  const meta = getBarcodeLabelMeta(settings.labelSize);
  const showHeader =
    (settings.showName && labels.some((label) => label.name)) ||
    (settings.showPrice && labels.some((label) => typeof label.price === "number"));

  return (
    <div
      className={`barcode-print-root${preview ? " barcode-print-root--preview" : ""}`}
      data-label-size={settings.labelSize}
      data-label-width-mm={meta.widthMm}
      data-label-height-mm={meta.heightMm}
    >
      {labels.map((label, index) => {
        const phoneMeta = formatBarcodePhoneMeta(settings, label);
        const renderOptions = getBarcodeRenderOptions(settings.labelSize, label.barcodeValue);

        return (
        <div key={`${label.barcodeValue}-${index}`} className="barcode-label-page">
          <div className="barcode-label" data-size={settings.labelSize}>
            {showHeader ? (
              <div className="barcode-label-header">
                {settings.showName && label.name ? (
                  <div className="barcode-label-name">{label.name}</div>
                ) : (
                  <span className="barcode-label-name-spacer" aria-hidden />
                )}
                {settings.showPrice && typeof label.price === "number" ? (
                  <div className="barcode-label-price">{formatCurrency(label.price)} ج.م</div>
                ) : null}
              </div>
            ) : null}
            <div className="barcode-label-graphic">
              <InvoiceBarcode
                value={label.barcodeValue}
                barcodeHeight={renderOptions.height}
                barWidth={renderOptions.barWidth}
                fontSize={renderOptions.fontSize}
                quietMargin={renderOptions.quietMargin}
                maxWidthMm={renderOptions.maxWidthMm}
                className="barcode-label-svg"
              />
            </div>
            {phoneMeta ? (
              <div className="barcode-label-phone-meta">{phoneMeta}</div>
            ) : null}
            {preview ? (
              <div className="barcode-label-size-hint" aria-hidden>
                {meta.label}
              </div>
            ) : null}
          </div>
        </div>
        );
      })}
    </div>
  );
}
