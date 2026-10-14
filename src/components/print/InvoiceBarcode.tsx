"use client";

import { useEffect, useRef } from "react";

const MM_TO_CSS_PX = 96 / 25.4;

function fitLabelBarcodeSvg(svg: SVGSVGElement, maxWidthMm: number) {
  const maxPx = Math.max(20, maxWidthMm * MM_TO_CSS_PX);
  const bbox = svg.getBBox();
  const nativeW = bbox.width || svg.width.baseVal.value;
  const nativeH = bbox.height || svg.height.baseVal.value;
  const targetPx = Math.min(maxPx, nativeW || maxPx);
  if (!nativeW || nativeW <= maxPx + 0.5) {
    svg.style.display = "block";
    svg.style.marginInline = "auto";
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
    return;
  }

  const scale = targetPx / nativeW;
  const viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("width", String(Math.floor(targetPx)));
  svg.setAttribute("height", String(Math.ceil(nativeH * scale)));
  svg.style.display = "block";
  svg.style.marginInline = "auto";
  svg.style.maxWidth = "100%";
  svg.style.width = `${Math.floor(targetPx)}px`;
  svg.style.height = "auto";
}

interface InvoiceBarcodeProps {
  value: string;
  compact?: boolean;
  className?: string;
  barcodeHeight?: number;
  barWidth?: number;
  fontSize?: number;
  /** هامش أبيض حول الباركود (ملصقات الطباعة) */
  quietMargin?: number;
  /** تصغير الباركود ليتسع داخل عرض الملصق (مم) */
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
          textMargin: 2,
          width: barWidth ?? (compact ? 1.2 : 1.6),
        });

        if (maxWidthMm != null && maxWidthMm > 0) {
          requestAnimationFrame(() => {
            if (!cancelled && svgRef.current) {
              fitLabelBarcodeSvg(svgRef.current, maxWidthMm);
            }
          });
        }
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
