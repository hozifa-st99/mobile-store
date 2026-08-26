"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { ProductMetaTypeLine } from "@/components/products/PhoneConditionBadge";
import { ClearableInput, FilterSelect } from "@/components/ui/FilterControls";
import { em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";

interface InventoryMovementEntry {
  id: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  quantity: number;
  signedQuantity: number;
  balanceAfter: number;
  documentNumber: string;
  date: string;
  partyName: string | null;
  detail: string | null;
  detailUrl: string;
}

interface ProductMovementHistory {
  productId: string;
  productName: string;
  brand: string;
  productType: string;
  deviceCondition?: string | null;
  currentQuantity: number;
  movementCount: number;
  entries: InventoryMovementEntry[];
}

interface ProductMovementModalProps {
  open: boolean;
  productId: string | null;
  productName?: string;
  onClose: () => void;
}

const typeBadgeClass: Record<string, string> = {
  stock_entry: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  purchase: "bg-primary/15 text-primary-light border-primary/30",
  purchase_return: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  sale: "bg-accent-green/15 text-accent-green border-accent-green/30",
  sale_return: "bg-red-500/15 text-red-400 border-red-500/30",
  stocktake: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

const typeLabels: Record<string, string> = {
  phone: "موبايل",
  accessory: "إكسسوار",
  spare_part: "قطعة غيار",
  smartwatch: "ساعة",
  tablet: "تابلت",
  laptop: "لابتوب",
};

const IMEI_LINE_PATTERN = /^\d{8,20}$/;

function extractImeisFromDetail(detail: string | null): string[] {
  if (!detail) return [];
  const imeis: string[] = [];
  for (const line of detail.split("\n")) {
    const trimmed = line.trim();
    if (IMEI_LINE_PATTERN.test(trimmed)) {
      imeis.push(trimmed);
    }
  }
  return imeis;
}

function movementMatchesImeiQuery(entry: InventoryMovementEntry, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const imeis = extractImeisFromDetail(entry.detail);
  return imeis.some((imei) => imei === q || imei.includes(q) || q.includes(imei));
}

function MovementDetailCell({ detail }: { detail: string | null }) {
  if (!detail) return <span>—</span>;

  const lines = detail.split("\n");
  if (lines[0]?.trim() !== "IMEI:") {
    return <span className="text-xs whitespace-pre-line leading-relaxed">{detail}</span>;
  }

  const groups: { imeis: string[]; notes: string[] }[] = [];
  let current: { imeis: string[]; notes: string[] } = { imeis: [], notes: [] };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    if (line === "IMEI:") {
      if (current.imeis.length > 0 || current.notes.length > 0) {
        groups.push(current);
      }
      current = { imeis: [], notes: [] };
      continue;
    }
    if (IMEI_LINE_PATTERN.test(line)) {
      current.imeis.push(line);
    } else {
      current.notes.push(line);
    }
  }

  if (current.imeis.length > 0 || current.notes.length > 0) {
    groups.push(current);
  }

  if (groups.length === 0) {
    return <span className="text-xs whitespace-pre-line leading-relaxed">{detail}</span>;
  }

  return (
    <div className="text-xs leading-relaxed min-w-[120px] space-y-2">
      {groups.map((group, index) => (
        <div
          key={`${group.imeis.join("-")}-${index}`}
          className={index > 0 ? "pt-2 border-t border-border/40" : undefined}
        >
          <span className="block text-muted mb-0.5">IMEI:</span>
          {group.imeis.map((imei) => (
            <span key={imei} className="block font-mono tabular-nums text-white/90 break-all">
              {imei}
            </span>
          ))}
          {group.notes.map((note) => (
            <span key={note} className="block text-muted mt-1">
              {note}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ProductMovementModal({
  open,
  productId,
  productName,
  onClose,
}: ProductMovementModalProps) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ProductMovementHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movementImeiFilter, setMovementImeiFilter] = useState("");
  const [movementImeiScan, setMovementImeiScan] = useState("");

  useEffect(() => {
    if (!open) {
      setMovementImeiFilter("");
      setMovementImeiScan("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !productId) {
      setHistory(null);
      setError(null);
      setMovementImeiFilter("");
      setMovementImeiScan("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void apiJson<{ history: ProductMovementHistory }>(`/api/inventory/${productId}/movements`)
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.history) {
          setHistory(data.history);
        } else {
          setHistory(null);
          setError("تعذر تحميل حركة المخزون");
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory(null);
        setError("تعذر تحميل حركة المخزون");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const movementImeiOptions = useMemo(() => {
    if (!history) return [];
    const imeis = new Set<string>();
    for (const entry of history.entries) {
      for (const imei of extractImeisFromDetail(entry.detail)) {
        imeis.add(imei);
      }
    }
    return Array.from(imeis).sort((a, b) => a.localeCompare(b, "ar"));
  }, [history]);

  const showImeiFilter = history?.productType === "phone" || movementImeiOptions.length > 0;

  const displayedEntries = useMemo(() => {
    if (!history) return [];
    let rows = history.entries;
    if (movementImeiScan.trim()) {
      rows = rows.filter((entry) => movementMatchesImeiQuery(entry, movementImeiScan));
    } else if (movementImeiFilter) {
      rows = rows.filter((entry) => extractImeisFromDetail(entry.detail).includes(movementImeiFilter));
    }
    return rows;
  }, [history, movementImeiFilter, movementImeiScan]);

  const hasImeiFilter = !!(movementImeiFilter || movementImeiScan.trim());

  const title = history?.productName || productName || "حركة المخزون";

  return (
    <Modal open={open} onClose={onClose} title={`عرض كامل للحركة — ${title}`} size="lg">
      {loading ? (
        <p className="text-sm text-muted text-center py-8">جاري التحميل...</p>
      ) : error ? (
        <p className="text-sm text-red-400 text-center py-8">{error}</p>
      ) : history ? (
        <div className="space-y-4 pb-1">
          <div className="rounded-xl border border-border/60 bg-background-input/30 px-4 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{history.productName}</p>
                <ProductMetaTypeLine
                  brand={history.brand}
                  type={history.productType}
                  typeLabel={typeLabels[history.productType] || history.productType}
                  deviceCondition={history.deviceCondition}
                />
                <p className="text-xs text-muted mt-2">
                  {hasImeiFilter
                    ? `${displayedEntries.length} من ${history.movementCount} حركة`
                    : `${history.movementCount} حركة`}
                </p>
              </div>

              <div className="product-movement-balance-oval shrink-0">
                <span className="product-movement-balance-oval__label">الرصيد المتبقي</span>
                <span className="product-movement-balance-oval__value tabular-nums">
                  {history.currentQuantity}
                </span>
              </div>
            </div>
          </div>

          {history.entries.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">لا توجد حركات مسجلة لهذا الصنف</p>
          ) : (
            <div className="product-movement-table-wrap rounded-xl border overflow-hidden flex flex-col h-[min(50dvh,420px)] min-h-[240px]">
              <div className="product-movement-table-wrap__hint px-4 py-2.5 border-b flex-shrink-0 space-y-2.5">
                <p className="text-xs">
                  من الأحدث للأقدم — مرّر داخل الجدول لعرض الكل
                </p>
                {showImeiFilter ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <FilterSelect
                      value={movementImeiFilter}
                      onChange={(value) => {
                        setMovementImeiFilter(value);
                        setMovementImeiScan("");
                      }}
                      onClear={() => setMovementImeiFilter("")}
                      className="sm:max-w-[220px]"
                    >
                      <option value="">كل IMEI</option>
                      {movementImeiOptions.map((imei) => (
                        <option key={imei} value={imei}>
                          {imei}
                        </option>
                      ))}
                    </FilterSelect>
                    <ClearableInput
                      value={movementImeiScan}
                      onChange={(value) => {
                        setMovementImeiScan(value);
                        setMovementImeiFilter("");
                      }}
                      onClear={() => setMovementImeiScan("")}
                      placeholder="امسح أو اكتب IMEI للفلترة المباشرة"
                      className="flex-1 min-w-0"
                    />
                  </div>
                ) : null}
              </div>
              <div className="overflow-auto flex-1 min-h-0 overscroll-contain product-movement-table-scroll">
                <table className="product-movement-table w-full min-w-[820px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-xs border-b">
                      <th className="text-right p-3 font-semibold w-10">#</th>
                      <th className="text-right p-3 font-semibold">التاريخ</th>
                      <th className="text-right p-3 font-semibold">النوع</th>
                      <th className="text-right p-3 font-semibold">المستند</th>
                      <th className="text-right p-3 font-semibold">الطرف</th>
                      <th className="text-right p-3 font-semibold">التفاصيل</th>
                      <th className="text-right p-3 font-semibold">الكمية</th>
                      <th className="text-right p-3 font-semibold">الرصيد</th>
                      <th className="text-right p-3 font-semibold">عرض</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-sm text-muted">
                          {hasImeiFilter
                            ? "لا توجد حركات مطابقة لـ IMEI المحدد"
                            : "لا توجد حركات مسجلة لهذا الصنف"}
                        </td>
                      </tr>
                    ) : (
                      displayedEntries.map((entry, index) => {
                      const badge = typeBadgeClass[entry.type] || "bg-white/10 text-white border-white/10";
                      return (
                        <tr key={entry.id} className="border-b">
                          <td className="p-3 text-xs tabular-nums">{index + 1}</td>
                          <td className="p-3">
                            <DocumentDateTimeStack
                              value={entry.date}
                              className="product-movement-table__datetime"
                            />
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg text-[11px] font-semibold border ${badge}`}
                            >
                              {entry.typeLabel}
                            </span>
                          </td>
                          <td className="p-3 font-semibold product-movement-table__document">
                            {entry.documentNumber}
                          </td>
                          <td
                            className="p-3 max-w-[140px] truncate product-movement-table__muted"
                            title={entry.partyName || undefined}
                          >
                            {entry.partyName || "—"}
                          </td>
                          <td className="p-3 align-top product-movement-table__muted">
                            <MovementDetailCell detail={entry.detail} />
                          </td>
                          <td className="p-3">
                            <span
                              className={`font-bold tabular-nums ${
                                entry.direction === "in"
                                  ? "product-movement-table__qty-in"
                                  : "product-movement-table__qty-out"
                              }`}
                            >
                              {entry.direction === "in" ? "+" : "−"}
                              {entry.quantity}
                            </span>
                          </td>
                          <td className="p-3 font-bold tabular-nums product-movement-table__balance">
                            {entry.balanceAfter}
                          </td>
                          <td className="p-3">
                            <Link
                              href={entry.detailUrl}
                              className="product-movement-table__link inline-flex items-center gap-1 text-xs font-semibold"
                            >
                              <span>{em.view}</span>
                              فتح
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
