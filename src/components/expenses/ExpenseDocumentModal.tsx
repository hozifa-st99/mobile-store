"use client";

import { useEffect, useState } from "react";

import Modal from "@/components/ui/Modal";
import DocumentDateTimeStack from "@/components/ui/DocumentDateTimeStack";
import { ActionEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";
import { formatAmountExact } from "@/lib/utils";

export interface ExpenseLineDetail {
  id: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  lineNumber: number;
  purchaseReturnId?: string | null;
}

export interface ExpenseDocumentDetail {
  id: string;
  invoiceNumber: string;
  paymentMethod: string;
  expenseDate: string;
  notes?: string | null;
  total: number;
  lineCount: number;
  lines: ExpenseLineDetail[];
}

interface LineDraft {
  category: string;
  description: string;
  amount: string;
}

interface ExpenseDocumentModalProps {
  open: boolean;
  documentId: string | null;
  onClose: () => void;
  onChanged: () => void;
  categoryLabels: Record<string, string>;
  paymentLabels: Record<string, string>;
}

export default function ExpenseDocumentModal({
  open,
  documentId,
  onClose,
  onChanged,
  categoryLabels,
  paymentLabels,
}: ExpenseDocumentModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [document, setDocument] = useState<ExpenseDocumentDetail | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});
  const [editingLineId, setEditingLineId] = useState<string | null>(null);

  const loadDocument = async (id: string) => {
    setLoading(true);
    const { ok, data } = await apiJson<{ document?: ExpenseDocumentDetail; message?: string }>(
      `/api/expenses/document/${id}`
    );
    setLoading(false);

    if (!ok || !data.document) {
      toast.error(data.message || "تعذر تحميل التفاصيل");
      onClose();
      return;
    }

    setDocument(data.document);
    setPaymentMethod(data.document.paymentMethod);
    setNotes(data.document.notes || "");
    setLineDrafts(
      Object.fromEntries(
        data.document.lines.map((line) => [
          line.id,
          {
            category: line.category,
            description: line.description,
            amount: String(line.amount),
          },
        ])
      )
    );
    setEditingLineId(null);
  };

  useEffect(() => {
    if (open && documentId) {
      void loadDocument(documentId);
    } else {
      setDocument(null);
      setEditingLineId(null);
    }
  }, [open, documentId]);

  const refreshAfterChange = async (id: string, closeIfDeleted = false) => {
    onChanged();
    const { ok, data } = await apiJson<{ document?: ExpenseDocumentDetail }>(
      `/api/expenses/document/${id}`
    );
    if (!ok || !data.document) {
      if (closeIfDeleted) onClose();
      return;
    }
    setDocument(data.document);
    setPaymentMethod(data.document.paymentMethod);
    setNotes(data.document.notes || "");
    setLineDrafts(
      Object.fromEntries(
        data.document.lines.map((line) => [
          line.id,
          {
            category: line.category,
            description: line.description,
            amount: String(line.amount),
          },
        ])
      )
    );
    setEditingLineId(null);
  };

  const saveDocument = async () => {
    if (!document) return;
    setSaving(true);
    try {
      const { ok, data } = await runPendingOperation(() =>
        apiJson<{ message?: string }>(`/api/expenses/document/${document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethod,
            notes: notes.trim() || null,
          }),
        })
      );

      if (!ok) {
        toast.error(data.message || "تعذر حفظ بيانات الفاتورة");
        return;
      }

      toast.success("تم حفظ بيانات الفاتورة");
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const saveLine = async (lineId: string) => {
    if (!document) return;
    const draft = lineDrafts[lineId];
    if (!draft) return;

    setSaving(true);
    try {
      const { ok, data } = await runPendingOperation(() =>
        apiJson<{ message?: string }>(`/api/expenses/${lineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: draft.category,
            description: draft.description,
            amount: Number(draft.amount),
          }),
        })
      );

      if (!ok) {
        toast.error(data.message || "تعذر حفظ البند");
        return;
      }

      toast.success("تم حفظ البند");
      await refreshAfterChange(document.id);
    } finally {
      setSaving(false);
    }
  };

  const deleteLine = async (lineId: string) => {
    if (!document) return;
    if (!confirm("حذف هذا البند؟")) return;

    const { ok, data } = await apiJson<{ message?: string }>(`/api/expenses/${lineId}`, {
      method: "DELETE",
    });

    if (!ok) {
      toast.error(data.message || "تعذر حذف البند");
      return;
    }

    toast.success("تم حذف البند");
    onChanged();
    const { ok: stillExists } = await apiJson(`/api/expenses/document/${document.id}`);
    if (!stillExists) {
      onClose();
      return;
    }
    await refreshAfterChange(document.id, true);
  };

  const deleteDocument = async () => {
    if (!document) return;
    if (!confirm(`حذف الفاتورة ${document.invoiceNumber} بالكامل؟`)) return;

    const { ok, data } = await apiJson<{ message?: string }>(
      `/api/expenses/document/${document.id}`,
      { method: "DELETE" }
    );

    if (!ok) {
      toast.error(data.message || "تعذر حذف الفاتورة");
      return;
    }

    toast.success("تم حذف الفاتورة");
    onChanged();
    onClose();
  };

  const updateLineDraft = (lineId: string, patch: Partial<LineDraft>) => {
    setLineDrafts((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], ...patch },
    }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={document ? `تفاصيل ${document.invoiceNumber}` : "تفاصيل المصروف"}
      size="lg"
    >
      {loading || !document ? (
        <p className="text-sm text-muted text-center py-8">جاري التحميل...</p>
      ) : (
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-card p-3">
              <p className="text-xs text-muted mb-1">التاريخ</p>
              <DocumentDateTimeStack value={document.expenseDate} />
            </div>
            <div className="glass-card p-3">
              <p className="text-xs text-muted mb-1">الإجمالي</p>
              <p className="text-lg font-bold text-red-400 tabular-nums">
                {formatAmountExact(document.total)} ج.م
              </p>
              <p className="text-xs text-muted mt-1">{document.lineCount} بند</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted mb-1">طريقة الدفع</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="glass-input"
              >
                <option value="cash">نقدي</option>
                <option value="card">بطاقة</option>
                <option value="transfer">تحويل</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted mb-1">ملاحظات</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="glass-input"
                placeholder="ملاحظات الفاتورة"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDocument()}
            className="btn-primary w-full sm:w-auto"
          >
            حفظ بيانات الفاتورة
          </button>

          <div className="space-y-3">
            <p className="text-sm font-bold text-white">البنود</p>
            {document.lines.map((line) => {
              const draft = lineDrafts[line.id];
              const isEditing = editingLineId === line.id;
              const locked = Boolean(line.purchaseReturnId);

              return (
                <div key={line.id} className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-primary-light">بند {line.lineNumber}</p>
                    <div className="flex gap-1">
                      {!locked ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingLineId((current) => (current === line.id ? null : line.id))
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted hover:text-white"
                          >
                            {isEditing ? "إلغاء" : "تعديل"}
                          </button>
                          <ActionEmoji
                            emoji={em.delete}
                            title="حذف البند"
                            onClick={() => void deleteLine(line.id)}
                            className="border-transparent text-red-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/30"
                          />
                        </>
                      ) : (
                        <span className="text-[11px] text-muted">مرتبط بمرتجع</span>
                      )}
                    </div>
                  </div>

                  {isEditing && draft && !locked ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={draft.category}
                        onChange={(e) => updateLineDraft(line.id, { category: e.target.value })}
                        className="glass-input"
                      >
                        {Object.entries(categoryLabels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <input
                        value={draft.description}
                        onChange={(e) =>
                          updateLineDraft(line.id, { description: e.target.value })
                        }
                        className="glass-input sm:col-span-1"
                        placeholder="الوصف"
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.amount}
                        onChange={(e) => updateLineDraft(line.id, { amount: e.target.value })}
                        className="glass-input"
                        placeholder="المبلغ"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveLine(line.id)}
                        className="btn-primary sm:col-span-3"
                      >
                        حفظ البند
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted">
                          {categoryLabels[line.category] || line.category}
                        </p>
                        <p className="text-sm text-white">{line.description}</p>
                      </div>
                      <p className="text-sm font-bold text-red-400 tabular-nums">
                        {formatAmountExact(line.amount)} ج.م
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={() => void deleteDocument()}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              حذف الفاتورة كاملة
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-muted hover:text-white"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
