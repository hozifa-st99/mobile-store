"use client";

import { useCallback, useEffect, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import ExpenseDocumentModal from "@/components/expenses/ExpenseDocumentModal";
import ReportDateFilter, { type ReportFilterState } from "@/components/reports/ReportDateFilter";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatAmountExact } from "@/lib/utils";

interface ExpenseLine {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  lineNumber: number;
}

interface ExpenseDocument {
  id: string;
  invoiceNumber: string;
  paymentMethod: string;
  expenseDate: string;
  notes?: string | null;
  total: number;
  lineCount: number;
  lines: ExpenseLine[];
}

interface DepositedExpense extends ExpenseLine {
  invoiceNumber: string;
  shiftId: string;
  shiftNumber: string;
  depositedAt: string;
}

interface ShiftOption {
  id: string;
  shiftNumber: string;
  closedAt: string;
}

interface ListLineForm {
  key: string;
  category: string;
  description: string;
  amount: string;
}

const categoryLabels: Record<string, string> = {
  rent: "إيجار",
  utilities: "مرافق",
  salary: "رواتب",
  marketing: "تسويق",
  other: "أخرى",
  "مصاريف مشتريات": "مصاريف مشتريات",
};

const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  transfer: "تحويل",
};

const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

function newListLine(): ListLineForm {
  return {
    key: `${Date.now()}-${Math.random()}`,
    category: "other",
    description: "",
    amount: "",
  };
}

function buildDepositedQuery(filter: ReportFilterState, shiftId: string) {
  const params = new URLSearchParams();
  if (filter.mode === "preset") {
    params.set("period", filter.period);
  } else if (filter.mode === "month") {
    params.set("month", filter.month || defaultMonth);
  } else if (filter.from && filter.to) {
    params.set("from", filter.from);
    params.set("to", filter.to);
  }
  if (shiftId) params.set("shiftId", shiftId);
  return params.toString();
}

export default function ExpensesPage() {
  const [documents, setDocuments] = useState<ExpenseDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [depositedExpenses, setDepositedExpenses] = useState<DepositedExpense[]>([]);
  const [depositedTotal, setDepositedTotal] = useState(0);
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [appliedShiftId, setAppliedShiftId] = useState("");
  const [rangeLabel, setRangeLabel] = useState("");
  const [filter, setFilter] = useState<ReportFilterState>({
    mode: "preset",
    period: "month",
    month: defaultMonth,
    from: "",
    to: "",
  });
  const [formMode, setFormMode] = useState<"none" | "single" | "list">("none");
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingDeposited, setLoadingDeposited] = useState(true);
  const [form, setForm] = useState({
    category: "other",
    description: "",
    amount: "",
    paymentMethod: "cash",
    notes: "",
  });
  const [listForm, setListForm] = useState({
    paymentMethod: "cash",
    notes: "",
    lines: [newListLine(), newListLine()],
  });
  const [detailsDocumentId, setDetailsDocumentId] = useState<string | null>(null);

  const loadOpenShift = useCallback(async () => {
    setLoadingOpen(true);
    const { ok, data } = await apiJson<{
      openShift?: {
        documents: ExpenseDocument[];
        total: number;
        documentCount: number;
        lineCount: number;
      };
    }>("/api/expenses");
    if (ok && data.openShift) {
      setDocuments(data.openShift.documents || []);
      setTotal(data.openShift.total || 0);
      setDocumentCount(data.openShift.documentCount || 0);
      setLineCount(data.openShift.lineCount || 0);
    }
    setLoadingOpen(false);
  }, []);

  const loadDeposited = useCallback(async (nextFilter: ReportFilterState, shiftId: string) => {
    setLoadingDeposited(true);
    const { ok, data } = await apiJson<{
      expenses?: DepositedExpense[];
      total?: number;
      range?: { label: string };
      shifts?: ShiftOption[];
    }>(`/api/expenses/deposited?${buildDepositedQuery(nextFilter, shiftId)}`);
    if (ok) {
      setDepositedExpenses(data.expenses || []);
      setDepositedTotal(data.total || 0);
      setRangeLabel(data.range?.label || "");
      setShiftOptions(data.shifts || []);
    }
    setLoadingDeposited(false);
  }, []);

  useEffect(() => {
    void loadOpenShift();
    void loadDeposited(filter, "");
    setAppliedShiftId("");
  }, []);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ok } = await apiJson("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });
    if (!ok) {
      toast.error("تعذر حفظ المصروف");
      return;
    }
    setForm({ category: "other", description: "", amount: "", paymentMethod: "cash", notes: "" });
    setFormMode("none");
    void loadOpenShift();
  };

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = listForm.lines
      .filter((line) => line.description.trim() && line.amount)
      .map((line) => ({
        category: line.category,
        description: line.description.trim(),
        amount: Number(line.amount),
      }));

    if (lines.length === 0) {
      toast.error("أضف بنداً واحداً على الأقل");
      return;
    }

    const { ok } = await apiJson("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: listForm.paymentMethod,
        notes: listForm.notes.trim() || null,
        lines,
      }),
    });

    if (!ok) {
      toast.error("تعذر حفظ قائمة المصروفات");
      return;
    }

    setListForm({
      paymentMethod: "cash",
      notes: "",
      lines: [newListLine(), newListLine()],
    });
    setFormMode("none");
    void loadOpenShift();
  };

  const handleDetailsChanged = () => {
    void loadOpenShift();
  };

  const applyDepositedFilters = () => {
    setAppliedShiftId(selectedShiftId);
    void loadDeposited(filter, selectedShiftId);
  };

  const updateListLine = (key: string, patch: Partial<ListLineForm>) => {
    setListForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
  };

  const listTotal = listForm.lines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0
  );

  return (
    <>
      <PageHeader
        title="المصروفات"
        subtitle="مصروف مفرد أو قائمة مصروفات برقم فاتورة — وتُقفل مع الوردية"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
        <div className="glass-card p-5 border border-accent-orange/20">
          <p className="text-xs text-muted mb-1">إجمالي الوردية الحالية</p>
          <p className="text-2xl font-bold text-accent-orange tabular-nums">
            {formatAmountExact(total)} ج.م
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted mb-1">عدد الفواتير</p>
          <p className="text-2xl font-bold text-white tabular-nums">{documentCount}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-muted mb-1">عدد البنود</p>
          <p className="text-2xl font-bold text-white tabular-nums">{lineCount}</p>
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <button
            type="button"
            onClick={() => setFormMode(formMode === "single" ? "none" : "single")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-semibold w-full justify-center"
          >
            <span className="text-lg leading-none">➕</span>
            مصروف جديد
          </button>
          <button
            type="button"
            onClick={() => setFormMode(formMode === "list" ? "none" : "list")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary/40 bg-primary/15 text-primary-light text-sm font-semibold w-full justify-center hover:bg-primary/25"
          >
            <span className="text-lg leading-none">📋</span>
            قائمة مصروفات
          </button>
        </div>
      </div>

      {formMode === "single" && (
        <form onSubmit={handleAddSingle} className="glass-card p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <p className="sm:col-span-2 text-sm font-bold text-white">مصروف مفرد — فاتورة ببند واحد</p>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="glass-input"
          >
            {Object.entries(categoryLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="glass-input"
            placeholder="الوصف *"
          />
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="glass-input"
            placeholder="المبلغ *"
          />
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="glass-input"
          >
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
            <option value="transfer">تحويل</option>
          </select>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="glass-input sm:col-span-2"
            placeholder="ملاحظات (اختياري)"
          />
          <button type="submit" className="btn-primary sm:col-span-2">
            حفظ المصروف
          </button>
        </form>
      )}

      {formMode === "list" && (
        <form onSubmit={handleAddList} className="glass-card p-5 mb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">قائمة مصروفات — فاتورة بعدة بنود</p>
              <p className="text-xs text-muted mt-1">يُنشأ رقم فاتورة واحد لكل القائمة</p>
            </div>
            <p className="text-sm font-bold text-accent-orange tabular-nums">
              الإجمالي: {formatAmountExact(listTotal)} ج.م
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={listForm.paymentMethod}
              onChange={(e) => setListForm({ ...listForm, paymentMethod: e.target.value })}
              className="glass-input"
            >
              <option value="cash">نقدي</option>
              <option value="card">بطاقة</option>
              <option value="transfer">تحويل</option>
            </select>
            <input
              value={listForm.notes}
              onChange={(e) => setListForm({ ...listForm, notes: e.target.value })}
              className="glass-input"
              placeholder="ملاحظات الفاتورة (اختياري)"
            />
          </div>

          <div className="space-y-2">
            {listForm.lines.map((line, index) => (
              <div
                key={line.key}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_120px_40px] gap-2 items-center"
              >
                <select
                  value={line.category}
                  onChange={(e) => updateListLine(line.key, { category: e.target.value })}
                  className="glass-input"
                >
                  {Object.entries(categoryLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={line.description}
                  onChange={(e) => updateListLine(line.key, { description: e.target.value })}
                  className="glass-input"
                  placeholder={`وصف البند ${index + 1} *`}
                />
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.amount}
                  onChange={(e) => updateListLine(line.key, { amount: e.target.value })}
                  className="glass-input"
                  placeholder="المبلغ *"
                />
                <button
                  type="button"
                  disabled={listForm.lines.length <= 1}
                  onClick={() =>
                    setListForm((prev) => ({
                      ...prev,
                      lines: prev.lines.filter((row) => row.key !== line.key),
                    }))
                  }
                  className="h-10 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                  title="حذف البند"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setListForm((prev) => ({ ...prev, lines: [...prev.lines, newListLine()] }))
              }
              className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:text-white"
            >
              + بند جديد
            </button>
            <button type="submit" className="btn-primary">
              حفظ قائمة المصروفات
            </button>
          </div>
        </form>
      )}

      <div className="mb-3">
        <h2 className="text-sm font-bold text-white mb-1">مصروفات الوردية الحالية</h2>
        <p className="text-xs text-muted">لم تُورد بعد — تُقفل وتُصفّر عند تقفيل الوردية من الخزنة</p>
      </div>

      <div className="glass-card overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم الفاتورة
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  التاريخ / الوقت
                </ThEmoji>
                <ThEmoji emoji={em.category} className="text-right p-4 font-medium">
                  التصنيف
                </ThEmoji>
                <ThEmoji emoji={em.description} className="text-right p-4 font-medium">
                  الوصف
                </ThEmoji>
                <ThEmoji emoji={em.payment} className="text-right p-4 font-medium">
                  الدفع
                </ThEmoji>
                <ThEmoji emoji={em.cost} className="text-right p-4 font-medium">
                  المبلغ
                </ThEmoji>
                <ThEmoji emoji={em.actions} className="text-right p-4 font-medium w-28">
                  إجراء
                </ThEmoji>
              </tr>
            </thead>
            <tbody>
              {loadingOpen ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted text-sm">
                    جاري التحميل...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted">
                    لا توجد مصروفات في الوردية الحالية
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const singleLine = doc.lineCount === 1 ? doc.lines[0] : null;
                  return (
                    <tr key={doc.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                      <td className="p-4 text-sm font-semibold text-primary-light">
                        {doc.invoiceNumber}
                      </td>
                      <td className="p-4">
                        <DocumentDateTimeStack value={doc.expenseDate} />
                      </td>
                      <td className="p-4">
                        {singleLine ? (
                          <span className="text-sm text-muted">
                            {categoryLabels[singleLine.category] || singleLine.category}
                          </span>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-white">قائمة مصروفات</p>
                            <p className="text-xs text-primary-light mt-1">{doc.lineCount} بنود</p>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {singleLine ? (
                          <p className="text-sm text-white">{singleLine.description}</p>
                        ) : (
                          <p className="text-sm text-muted">{doc.notes?.trim() || "—"}</p>
                        )}
                      </td>
                      <td className="p-4 text-xs text-muted">
                        {paymentLabels[doc.paymentMethod] || doc.paymentMethod}
                      </td>
                      <td className="p-4 text-sm font-semibold text-red-400 tabular-nums">
                        {formatAmountExact(doc.total)} ج.م
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setDetailsDocumentId(doc.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-primary/40 bg-primary/15 text-primary-light hover:bg-primary/25"
                        >
                          <span>{em.view}</span>
                          عرض التفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseDocumentModal
        open={detailsDocumentId !== null}
        documentId={detailsDocumentId}
        onClose={() => setDetailsDocumentId(null)}
        onChanged={handleDetailsChanged}
        categoryLabels={categoryLabels}
        paymentLabels={paymentLabels}
      />

      <div className="mb-3">
        <h2 className="text-sm font-bold text-white mb-1">المصاريف السابقة للتوريدات السابقة</h2>
        <p className="text-xs text-muted">
          إجمالي الفترة: {formatAmountExact(depositedTotal)} ج.م — {depositedExpenses.length} بند
          {rangeLabel ? ` · ${rangeLabel}` : ""}
        </p>
      </div>

      <ReportDateFilter
        value={filter}
        onChange={setFilter}
        onApply={applyDepositedFilters}
        loading={loadingDeposited}
        rangeLabel={rangeLabel}
      />

      <div className="glass-card p-4 mb-4">
        <label className="block text-xs font-bold text-muted mb-2">تصفية بالوردية</label>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <select
            value={selectedShiftId}
            onChange={(e) => setSelectedShiftId(e.target.value)}
            className="glass-input sm:max-w-xs"
          >
            <option value="">كل الورديات</option>
            {shiftOptions.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.shiftNumber} —{" "}
                {new Date(shift.closedAt).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyDepositedFilters}
            disabled={selectedShiftId === appliedShiftId && !loadingDeposited}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/25 border border-primary/40 text-primary-light hover:bg-primary/35 disabled:opacity-40"
          >
            تطبيق الوردية
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  رقم الفاتورة
                </ThEmoji>
                <ThEmoji emoji={em.invoice} className="text-right p-4 font-medium">
                  الوردية
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  تاريخ التوريد
                </ThEmoji>
                <ThEmoji emoji={em.date} className="text-right p-4 font-medium">
                  تاريخ المصروف
                </ThEmoji>
                <ThEmoji emoji={em.description} className="text-right p-4 font-medium">
                  البند
                </ThEmoji>
                <ThEmoji emoji={em.cost} className="text-right p-4 font-medium">
                  المبلغ
                </ThEmoji>
              </tr>
            </thead>
            <tbody>
              {loadingDeposited ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted text-sm">
                    جاري التحميل...
                  </td>
                </tr>
              ) : depositedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted">
                    لا توجد مصروفات موردة في هذه الفترة
                  </td>
                </tr>
              ) : (
                depositedExpenses.map((e) => (
                  <tr
                    key={`${e.shiftId}-${e.id}`}
                    className="border-b border-border/40 hover:bg-white/[0.02]"
                  >
                    <td className="p-4 text-sm font-semibold text-primary-light">
                      {e.invoiceNumber}
                      {e.lineNumber > 1 ? (
                        <span className="text-[11px] text-muted block">بند {e.lineNumber}</span>
                      ) : null}
                    </td>
                    <td className="p-4 text-sm font-semibold text-primary-light">{e.shiftNumber}</td>
                    <td className="p-4">
                      <DocumentDateTimeStack value={e.depositedAt} />
                    </td>
                    <td className="p-4">
                      <DocumentDateTimeStack value={e.expenseDate} />
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-muted">
                        {categoryLabels[e.category] || e.category}
                      </p>
                      <p className="text-sm text-white">{e.description}</p>
                    </td>
                    <td className="p-4 text-sm font-semibold text-red-400 tabular-nums">
                      {formatAmountExact(e.amount)} ج.م
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
