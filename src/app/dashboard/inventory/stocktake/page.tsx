"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import StocktakeLinesTable from "@/components/stocktake/StocktakeLinesTable";
import StocktakeStartModal from "@/components/stocktake/StocktakeStartModal";
import StocktakeTableFilters from "@/components/stocktake/StocktakeTableFilters";
import { apiJson } from "@/lib/api-client";
import type { StocktakeLine, StocktakeProductFilter } from "@/lib/stocktake-line-types";
import {
  applyStocktakeLineFilters,
  computeStocktakeAdjustmentAmount,
  expandStocktakeLinesForSubmit,
  extractAccessoryCategoryFilterOptions,
  extractPhoneBrandFilterOptions,
  formatStocktakeAdjustmentAmount,
  formatStocktakeUnitCost,
  recomputePhoneLineFromSerials,
} from "@/lib/stocktake-line-utils";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";

type StocktakeMode = "full" | "partial";

function normalizeStocktakeLine(line: StocktakeLine): StocktakeLine {
  if (line.productType === "phone" && line.serials.length > 0) {
    return recomputePhoneLineFromSerials(line);
  }
  return line;
}

function recomputeLine(line: StocktakeLine, countedQuantity: number): StocktakeLine {
  const counted = Math.max(0, countedQuantity);
  return {
    ...line,
    countedQuantity: counted,
    variance: counted - line.systemQuantity,
  };
}

export default function StocktakePage() {
  const router = useRouter();

  const [startOpen, setStartOpen] = useState(true);
  const [mode, setMode] = useState<StocktakeMode | null>(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<StocktakeLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<StocktakeProductFilter>("all");
  const [subFilter, setSubFilter] = useState("");
  const [partialSearch, setPartialSearch] = useState("");
  const [partialResults, setPartialResults] = useState<StocktakeLine[]>([]);
  const [partialSearching, setPartialSearching] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [completedDoc, setCompletedDoc] = useState<{ id: string; documentNumber: string } | null>(
    null
  );

  const loadDocumentNumber = useCallback(async () => {
    const { ok, data } = await apiJson<{ documentNumber?: string }>(
      "/api/stocktakes/next-document-number"
    );
    if (ok && data.documentNumber) setDocumentNumber(data.documentNumber);
  }, []);

  const loadFullLines = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await apiJson<{ lines: StocktakeLine[] }>("/api/stocktakes/lines");
    if (ok && data.lines) {
      setLines(data.lines.map(normalizeStocktakeLine));
    } else {
      toast.error("تعذر تحميل أصناف المخزون");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mode) void loadDocumentNumber();
  }, [mode, loadDocumentNumber]);

  const phoneBrandOptions = useMemo(() => extractPhoneBrandFilterOptions(lines), [lines]);
  const categoryOptions = useMemo(() => extractAccessoryCategoryFilterOptions(lines), [lines]);

  const hasActiveFilters =
    typeFilter !== "all" || !!subFilter.trim() || !!tableSearch.trim();

  const filteredFullLines = useMemo(() => {
    if (mode !== "full") return lines;
    return applyStocktakeLineFilters(lines, {
      search: tableSearch,
      typeFilter,
      subFilter,
    });
  }, [lines, mode, tableSearch, typeFilter, subFilter]);

  const filteredPartialLines = useMemo(
    () =>
      applyStocktakeLineFilters(lines, {
        typeFilter,
        subFilter,
      }),
    [lines, typeFilter, subFilter]
  );

  const clearTableFilters = () => {
    setTableSearch("");
    setTypeFilter("all");
    setSubFilter("");
  };

  const handleTypeFilterChange = (value: StocktakeProductFilter) => {
    setTypeFilter(value);
    setSubFilter("");
  };

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const variance = line.countedQuantity - line.systemQuantity;
        acc.system += line.systemQuantity;
        acc.counted += line.countedQuantity;
        acc.variance += variance;
        acc.adjustmentAmount += computeStocktakeAdjustmentAmount(line);
        return acc;
      },
      { system: 0, counted: 0, variance: 0, adjustmentAmount: 0 }
    );
  }, [lines]);

  const startFull = async () => {
    setStartOpen(false);
    setMode("full");
    await loadFullLines();
  };

  const startPartial = () => {
    setStartOpen(false);
    setMode("partial");
    setLines([]);
  };

  const handleSerialPresentChange = (lineId: string, serialId: string, present: boolean) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;
        const serials = line.serials.map((serial) =>
          serial.id === serialId ? { ...serial, present } : serial
        );
        return recomputePhoneLineFromSerials({ ...line, serials });
      })
    );
  };

  const handleCountedChange = (lineId: string, countedQuantity: number) => {
    setLines((prev) =>
      prev.map((line) =>
        line.lineId === lineId ? recomputeLine(line, countedQuantity) : line
      )
    );
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  useEffect(() => {
    if (mode !== "partial") return;
    if (!partialSearch.trim()) {
      setPartialResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setPartialSearching(true);
      const { ok, data } = await apiJson<{ lines: StocktakeLine[] }>(
        `/api/stocktakes/search?q=${encodeURIComponent(partialSearch.trim())}`
      );
      if (ok && data.lines) setPartialResults(data.lines);
      setPartialSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [partialSearch, mode]);

  const addPartialLine = (line: StocktakeLine) => {
    setLines((prev) => {
      if (prev.some((item) => item.lineId === line.lineId)) {
        toast.info("الصنف مضاف بالفعل للجرد");
        return prev;
      }
      return [...prev, normalizeStocktakeLine({ ...line, countedQuantity: line.systemQuantity, variance: 0 })];
    });
    setPartialSearch("");
    setPartialResults([]);
  };

  const handleSubmit = async () => {
    if (lines.length === 0) {
      toast.error("يجب إضافة صنف واحد على الأقل");
      return;
    }

    setSaving(true);
    try {
      const { ok, data } = await runPendingOperation(() =>
        apiJson<{
          stocktake?: { id: string; documentNumber: string };
          message?: string;
        }>("/api/stocktakes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            notes,
            documentNumber,
            items: expandStocktakeLinesForSubmit(lines),
          }),
        })
      );

      if (ok && data.stocktake) {
        setCompletedDoc(data.stocktake);
        setSuccessOpen(true);
        return;
      }

      toast.error(data?.message || "تعذر اعتماد الجرد");
    } finally {
      setSaving(false);
    }
  };

  const resetSession = () => {
    setSuccessOpen(false);
    setCompletedDoc(null);
    setMode(null);
    setLines([]);
    setTableSearch("");
    setTypeFilter("all");
    setSubFilter("");
    setPartialSearch("");
    setPartialResults([]);
    setNotes("");
    setStartOpen(true);
  };

  return (
    <>
      <PageHeader title="تسوية / جرد" subtitle="مطابقة الرصيد الفعلي مع المخزون" />

      {!mode ? (
        <div className="glass-card p-12 text-center text-muted">
          <p className="text-sm">اضغط «بدء جرد» لاختيار جرد كلي أو جزئي</p>
          <button type="button" onClick={() => setStartOpen(true)} className="btn-primary mt-4 px-8">
            بدء جرد
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="glass-card p-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-xs text-muted mb-1">رقم المستند</p>
                <p className="font-bold text-primary-light">{documentNumber || "..."}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">نوع الجرد</p>
                <p className="font-bold text-white">{mode === "full" ? "جرد كلي" : "جرد جزئي"}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">إجمالي التسوية</p>
                <p className={`font-bold tabular-nums ${totals.variance === 0 ? "text-muted" : totals.variance > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totals.variance > 0 ? `+${totals.variance}` : totals.variance}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">إجمالي مبلغ التسوية</p>
                <p
                  className={`font-bold tabular-nums ${
                    totals.adjustmentAmount === 0
                      ? "text-muted"
                      : totals.adjustmentAmount > 0
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {formatStocktakeAdjustmentAmount(totals.adjustmentAmount)} ج.م
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetSession}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || lines.length === 0}
                className="btn-primary px-6 py-2.5 disabled:opacity-50"
              >
                {saving ? "جاري الاعتماد..." : "اعتماد الجرد"}
              </button>
            </div>
          </div>

          {mode === "full" ? (
            <div className="glass-card p-4">
              <StocktakeTableFilters
                search={tableSearch}
                onSearchChange={setTableSearch}
                typeFilter={typeFilter}
                onTypeFilterChange={handleTypeFilterChange}
                subFilter={subFilter}
                onSubFilterChange={setSubFilter}
                phoneBrandOptions={phoneBrandOptions}
                categoryOptions={categoryOptions}
                onClear={clearTableFilters}
                showClear={hasActiveFilters}
              />
              <div className="product-movement-table-wrap overflow-auto max-h-[min(58dvh,560px)]">
                {loading ? (
                  <p className="text-sm text-muted text-center py-10">جاري التحميل...</p>
                ) : (
                  <StocktakeLinesTable
                    lines={filteredFullLines}
                    onCountedChange={handleCountedChange}
                    onSerialPresentChange={handleSerialPresentChange}
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="glass-card p-4 space-y-3">
                <p className="text-sm font-semibold text-white">إضافة صنف للجرد الجزئي</p>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg opacity-60">🔍</span>
                  <input
                    value={partialSearch}
                    onChange={(e) => setPartialSearch(e.target.value)}
                    placeholder="بحث بالاسم أو الباركود أو IMEI..."
                    className="w-full bg-background-input border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm text-white"
                  />
                </div>
                {partialSearching ? (
                  <p className="text-xs text-muted">جاري البحث...</p>
                ) : partialResults.length > 0 ? (
                  <div className="space-y-2">
                    {partialResults.map((line) => (
                      <div
                        key={line.lineId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background-input/20 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white whitespace-pre-line">
                            {line.details}
                          </p>
                          <p className="text-xs text-muted mt-1">
                            الكمية: {line.systemQuantity} · التكلفة: {formatStocktakeUnitCost(line)} ج.م
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addPartialLine(line)}
                          className="px-3 py-2 rounded-lg bg-primary/20 border border-primary/30 text-xs font-semibold text-primary-light hover:bg-primary/30"
                        >
                          إضافة
                        </button>
                      </div>
                    ))}
                  </div>
                ) : partialSearch.trim() ? (
                  <p className="text-xs text-muted">لا توجد نتائج</p>
                ) : null}
              </div>

              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50">
                  <h3 className="text-sm font-bold text-white mb-3">
                    أصناف الجرد الجزئي ({filteredPartialLines.length})
                  </h3>
                  <StocktakeTableFilters
                    search=""
                    onSearchChange={() => {}}
                    typeFilter={typeFilter}
                    onTypeFilterChange={handleTypeFilterChange}
                    subFilter={subFilter}
                    onSubFilterChange={setSubFilter}
                    phoneBrandOptions={phoneBrandOptions}
                    categoryOptions={categoryOptions}
                    onClear={clearTableFilters}
                    showClear={typeFilter !== "all" || !!subFilter.trim()}
                    showSearch={false}
                  />
                </div>
                <div className="product-movement-table-wrap overflow-auto max-h-[min(50dvh,480px)] p-1">
                  <StocktakeLinesTable
                    lines={filteredPartialLines}
                    onCountedChange={handleCountedChange}
                    onSerialPresentChange={handleSerialPresentChange}
                    onRemove={handleRemoveLine}
                    showRemove
                  />
                </div>
              </div>
            </>
          )}

          <div className="glass-card p-4">
            <label className="block text-xs text-muted mb-1.5">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="glass-input min-h-[72px] resize-y"
              placeholder="ملاحظات على عملية الجرد..."
            />
          </div>
        </div>
      )}

      <StocktakeStartModal
        open={startOpen && !successOpen}
        onClose={() => setStartOpen(false)}
        onSelectFull={() => void startFull()}
        onSelectPartial={startPartial}
      />

      <Modal
        open={successOpen}
        onClose={resetSession}
        title="تم اعتماد الجرد"
        size="sm"
      >
        {completedDoc ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
              <p className="text-xs text-muted mb-1">رقم مستند الجرد</p>
              <p className="text-lg font-bold text-emerald-300">{completedDoc.documentNumber}</p>
            </div>
            <p className="text-sm text-muted text-center">
              تم حفظ الجرد وتحديث كميات المخزون حسب الرصيد الفعلي.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={resetSession}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white"
              >
                جرد جديد
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/inventory/stocktake/${completedDoc.id}`)}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                عرض المستند
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
