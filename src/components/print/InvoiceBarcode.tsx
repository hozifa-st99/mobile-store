"use client";

import { useEffect, useRef } from "react";

interface InvoiceBarcodeProps {
  value: string;
  compact?: boolean;
  className?: string;
  barcodeHeight?: number;
  barWidth?: number;
  fontSize?: number;
}

export default function InvoiceBarcode({
  value,
  compact = false,
  className,
  barcodeHeight,
  barWidth,
  fontSize,
}: InvoiceBarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    let cancelled = false;

    import("jsbarcode")
      .then(({ default: JsBarcode }) => {
        if (cancelled || !svgRef.current) return;
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          displayValue: true,
          font: "Tajawal, sans-serif",
          fontSize: fontSize ?? (compact ? 10 : 12),
          height: barcodeHeight ?? (compact ? 34 : 48),
          margin: 0,
          textAlign: "center",
          textMargin: 2,
          width: barWidth ?? (compact ? 1.2 : 1.6),
        });
      })
      .catch(() => {
        /* ignore barcode render errors */
      });

    return () => {
      cancelled = true;
    };
  }, [value, compact, barcodeHeight, barWidth, fontSize]);

  return <svg ref={svgRef} role="img" aria-label={`باركود ${value}`} className={className} />;
}
