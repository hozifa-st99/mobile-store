"use client";

import { Fragment, useState } from "react";

import type { StocktakeLine } from "@/lib/stocktake-line-types";
import {
  computeStocktakeAdjustmentAmount,
  formatStocktakeAdjustmentAmount,
  formatStocktakeUnitCost,
  isPhoneStocktakeLine,
} from "@/lib/stocktake-line-utils";
import { formatAmountExact } from "@/lib/utils";

interface StocktakeLinesTableProps {
  lines: StocktakeLine[];
  onCountedChange?: (lineId: string, countedQuantity: number) => void;
  onSerialPresentChange?: (lineId: string, serialId: string, present: boolean) => void;
  onRemove?: (lineId: string) => void;
  showRemove?: boolean;
  readOnly?: boolean;
}

function varianceLabel(variance: number) {
  if (variance > 0) return `+${variance}`;
  if (variance < 0) return `${variance}`;
  return "0";
}

function varianceClass(variance: number) {
  if (variance > 0) return "text-emerald-400";
  if (variance < 0) return "text-red-400";
  return "text-muted";
}

function adjustmentClass(amount: number) {
  if (amount > 0) return "text-emerald-400";
  if (amount < 0) return "text-red-400";
  return "text-muted";
}

function StocktakeSerialImeiCell({
  serial,
}: {
  serial: { imei: string | null; imeis?: string[] };
}) {
  const imeis =
    serial.imeis && serial.imeis.length > 0
      ? serial.imeis
      : serial.imei
        ? [serial.imei]
        : [];

  if (imeis.length === 0) return <span>—</span>;

  return (
    <div className="space-y-1">
      {imeis.map((imei) => (
        <div key={imei} className="font-mono text-primary-light break-all">
          {imei}
        </div>
      ))}
    </div>
  );
}

export default function StocktakeLinesTable({
  lines,
  onCountedChange,
  onSerialPresentChange,
  onRemove,
  showRemove = false,
  readOnly = false,
}: StocktakeLinesTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (lines.length === 0) {
    return <p className="text-sm text-muted text-center py-10">لا توجد أصناف في الجرد</p>;
  }

  const colCount = 7 + (showRemove ? 1 : 0);

  const toggleExpand = (lineId: string) => {
    setExpandedIds((prev) => {
      if (prev.has(lineId)) return new Set();
      return new Set([lineId]);
    });
  };

  return (
    <table className="product-movement-table stocktake-lines-table w-full min-w-[1120px] text-sm">
      <thead>
        <tr className="text-xs border-b">
          <th className="text-right p-3 font-semibold w-12">#</th>
          <th className="text-right p-3 font-semibold">الصنف / الباركود / IMEI</th>
          <th className="text-right p-3 font-semibold">الكمية</th>
          <th className="text-right p-3 font-semibold">الرصيد الفعلي</th>
          <th className="text-right p-3 font-semibold">تسوية الجرد</th>
          <th className="text-right p-3 font-semibold">مبلغ التسوية</th>
          <th className="text-right p-3 font-semibold">تكلفة القطعة</th>
          {showRemove ? <th className="text-right p-3 font-semibold w-20">إزالة</th> : null}
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => {
          const variance = line.countedQuantity - line.systemQuantity;
          const adjustmentAmount = computeStocktakeAdjustmentAmount(line);
          const phoneLine = isPhoneStocktakeLine(line);
          const expandable = phoneLine;
          const isExpanded = expandedIds.has(line.lineId);

          return (
            <Fragment key={line.lineId}>
              <tr
                className={`border-b ${expandable ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
                onClick={() => {
                  if (expandable) toggleExpand(line.lineId);
                }}
              >
                <td className="p-3 text-muted tabular-nums">{index + 1}</td>
                <td className="p-3">
                  <div className="flex items-start gap-2">
                    {expandable ? (
                      <span
                        className={`mt-0.5 text-xs text-amber-300 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    ) : null}
                    <p className="font-semibold text-white whitespace-pre-line leading-relaxed">
                      {line.details}
                    </p>
                  </div>
                </td>
                <td className="p-3 font-bold tabular-nums text-white">{line.systemQuantity}</td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  {readOnly || phoneLine ? (
                    <span className="font-bold tabular-nums text-white">{line.countedQuantity}</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={line.countedQuantity}
                      onChange={(e) =>
                        onCountedChange?.(
                          line.lineId,
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                      className="w-24 glass-input py-2 text-sm font-bold tabular-nums"
                    />
                  )}
                </td>
                <td className={`p-3 font-bold tabular-nums ${varianceClass(variance)}`}>
                  {varianceLabel(variance)}
                  {variance !== 0 ? (
                    <span className="block text-[10px] font-normal mt-0.5 opacity-80">
                      {variance > 0 ? "زيادة" : "نقص"}
                    </span>
                  ) : null}
                </td>
                <td className={`p-3 font-bold tabular-nums ${adjustmentClass(adjustmentAmount)}`}>
                  {formatStocktakeAdjustmentAmount(adjustmentAmount)} ج.م
                </td>
                <td className="p-3 font-bold tabular-nums text-amber-200">
                  {formatStocktakeUnitCost(line)} ج.م
                </td>
                {showRemove ? (
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onRemove?.(line.lineId)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      حذف
                    </button>
                  </td>
                ) : null}
              </tr>

              {expandable && isExpanded ? (
                <tr className="border-b bg-black/25">
                  <td colSpan={colCount} className="p-0">
                    <div className="px-4 py-3 border-t border-amber-500/15">
                      <p className="text-[11px] font-semibold text-amber-300/90 mb-2">
                        الأجهزة ({line.serials.length}) — حدّد الموجود فعلياً
                      </p>
                      <table className="w-full min-w-[820px] text-xs">
                        <thead>
                          <tr className="text-muted border-b border-white/5">
                            <th className="text-right py-2 pr-2 font-semibold w-16">موجود</th>
                            <th className="text-right py-2 pr-2 font-semibold">#</th>
                            <th className="text-right py-2 pr-2 font-semibold">IMEI</th>
                            <th className="text-right py-2 pr-2 font-semibold">الباركود</th>
                            <th className="text-right py-2 pr-2 font-semibold">تكلفة القطعة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.serials.map((serial, serialIndex) => {
                            const isPresent = serial.present !== false;

                            return (
                              <tr key={serial.id} className="border-b border-white/5 last:border-0">
                                <td className="py-2.5 pr-2" onClick={(e) => e.stopPropagation()}>
                                  {readOnly ? (
                                    <span
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-sm ${
                                        isPresent
                                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                          : "border-red-500/30 bg-red-500/10 text-red-300"
                                      }`}
                                    >
                                      {isPresent ? "✓" : "✗"}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onSerialPresentChange?.(line.lineId, serial.id, !isPresent)
                                      }
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-sm transition-colors ${
                                        isPresent
                                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                          : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                      }`}
                                      title={isPresent ? "موجود — اضغط للإلغاء" : "غير موجود — اضغط للتأكيد"}
                                    >
                                      {isPresent ? "✓" : "✗"}
                                    </button>
                                  )}
                                </td>
                                <td className="py-2.5 pr-2 text-muted tabular-nums">
                                  {serialIndex + 1}
                                </td>
                                <td className="py-2.5 pr-2">
                                  <StocktakeSerialImeiCell serial={serial} />
                                </td>
                                <td className="py-2.5 pr-2 font-mono text-muted">
                                  {serial.barcode || "—"}
                                </td>
                                <td className="py-2.5 pr-2 font-bold tabular-nums text-amber-200">
                                  {formatAmountExact(serial.unitCost)} ج.م
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
