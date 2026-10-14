"use client";

import { useEffect, useRef } from "react";

/** يملأ عرض منطقة البarcode (بعد 5 مم من كل جانب) — بدون px ثابت يتكسر في الطباعة */
function fitLabelBarcodeSvg(svg: SVGSVGElement) {
  const bbox = svg.getBBox();
  const nativeW = bbox.width;
  const nativeH = bbox.height;
  if (!nativeW || !nativeH) return;

  svg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.display = "block";
  svg.style.width = "100%";
  svg.style.maxWidth = "100%";
  svg.style.height = "auto";
  svg.style.marginInline = "auto";
}

interface InvoiceBarcodeProps {
  value: string;
  compact?: boolean;
  className?: string;
  barcodeHeight?: number;
  barWidth?: number;
  fontSize?: number;
  quietMargin?: number;
  maxWidthMm?: number;
}

export default function InvoiceBarcode({
  value,
  compact = false,
  className,
  barcodeHeight,
  barWidth,
  fontSize,
  quietMargin,
  maxWidthMm,
}: InvoiceBarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    let cancelled = false;

    import("jsbarcode")
      .then(({ default: JsBarcode }) => {
        if (cancelled || !svgRef.current) return;
        const svg = svgRef.current;
        svg.removeAttribute("viewBox");
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.transform = "";
        svg.style.width = "";
        svg.style.height = "";

        JsBarcode(svg, value, {
          format: "CODE128",
          displayValue: true,
          font: "Tajawal, sans-serif",
          fontSize: fontSize ?? (compact ? 10 : 12),
          height: barcodeHeight ?? (compact ? 34 : 48),
          margin: quietMargin ?? 0,
          textAlign: "center",
          textMargin: 1,
          width: barWidth ?? (compact ? 1.2 : 1.6),
        });

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled && svgRef.current) {
              fitLabelBarcodeSvg(svgRef.current);
            }
          });
        });
      })
      .catch(() => {
        /* ignore barcode render errors */
      });

    return () => {
      cancelled = true;
    };
  }, [value, compact, barcodeHeight, barWidth, fontSize, quietMargin, maxWidthMm]);

  return <svg ref={svgRef} role="img" aria-label={`باركود ${value}`} className={className} />;
}
