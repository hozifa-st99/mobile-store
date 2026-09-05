"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PageHeader from "@/components/layout/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import Modal from "@/components/ui/Modal";
import { ActionEmoji, CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { useScreenAccess } from "@/hooks/use-screen-access";
import { apiJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { runPendingOperation } from "@/store/pending-operation-store";
import { cn, formatAmountExact, formatCurrency } from "@/lib/utils";
import { formatDocumentDate, formatDocumentTime } from "@/lib/document-datetime";
import { useAuthStore } from "@/store/auth-store";

type PartyType = "supplier" | "customer";

interface PartyOption {
  id: string;
  nameAr: string;
  phone?: string | null;
}

interface PartyReportRow {
  reportKey: string;
  partyId: string;
  partyName: string;
  partyPhone: string | null;
  branchId: string | null;
  branchName: string | null;
  creditAmount: number;
  paidAmount: number;
  outstanding: number;
  entryCount: number;
  firstEntryDate: string;
  lastActivityDate: string;
}

interface PartyFilterOption {
  partyId: string;
  partyName: string;
  partyPhone: string | null;
}

interface BranchFilterOption {
  branchId: string;
  branchName: string;
}

interface LedgerResponse {
  totals: { creditAmount: number; paidAmount: number; outstanding: number };
  partyReport: PartyReportRow[];
  partyOptions: PartyFilterOption[];
  branchOptions: BranchFilterOption[];
}

interface PartyDetailsResponse {
  party: {
    partyId: string;
    partyType: string;
    partyName: string;
    firstEntryDate: string;
    creditAmount: number;
    paidAmount: number;
    outstanding: number;
  };
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  id: string;
  type: "credit" | "payment" | "combined";
  label: string;
  date: string;
  amount: number;
  creditAmount?: number;
  paidAmount?: number;
  balanceAfter: number;
  notes: string | null;
  recordedByName?: string | null;
}

function formatLedgerDate(value: string) {
  return formatDocumentDate(value);
}

function formatLedgerTime(value: string) {
  return formatDocumentTime(value);
}

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyLedgerMessage(search: string, onlyOutstanding: boolean, tabLabel: string) {
  if (search.trim()) return "لا توجد نتائج للبحث";
  if (onlyOutstanding) return `لا توجد ديون أو أجل بمستحق لـ${tabLabel}`;
  return `لا توجد ديون أو أجل مسجّلة لـ${tabLabel}`;
}

const filterFieldClass =
  "h-11 w-full bg-background-input border border-border rounded-xl text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all duration-200";

const ledgerTableViewportClass = "overflow-auto max-h-[calc(100vh-22rem)] min-h-[12rem]";

const ledgerTableHeadCellClass =
  "sticky top-0 z-10 bg-background-card text-right p-4 font-medium shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]";

function branchQueryValue(branchId: string | null) {
  return branchId ?? "__none__";
}

function branchDisplayName(branchName: string | null) {
  return branchName?.trim() || "بدون فرع";
}

export default function DebtsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { canAccessPath } = useScreenAccess();
  const canAccessDebts = canAccessPath("/debts");

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<PartyType>("supplier");
  const [view, setView] = useState<"detail" | "summary">("detail");
  const [onlyOutstanding, setOnlyOutstanding] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [partyOptions, setPartyOptions] = useState<PartyFilterOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchFilterOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [partyReport, setPartyReport] = useState<PartyReportRow[]>([]);
  const [totals, setTotals] = useState({ creditAmount: 0, paidAmount: 0, outstanding: 0 });

  const [parties, setParties] = useState<PartyOption[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsParty, setDetailsParty] = useState<PartyReportRow | null>(null);
  const [detailsTimeline, setDetailsTimeline] = useState<TimelineEvent[]>([]);
  const [payTarget, setPayTarget] = useState<PartyReportRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [pendingPayAmount, setPendingPayAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [addForm, setAddForm] = useState({
    partyId: "",
    branchId: "",
    entryDate: todayInputValue(),
    creditAmount: "",
    paidAmount: "",
    notes: "",
  });

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
    else setReady(true);
  }, [isAuthenticated, router]);

  const loadLedger = async () => {
    setLoading(true);
    const q = new URLSearchParams({
      partyType: tab,
      ...(onlyOutstanding ? { onlyOutstanding: "1" } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(selectedPartyId ? { partyId: selectedPartyId } : {}),
      ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
    });
    const { ok, data } = await apiJson<LedgerResponse & { message?: string }>(`/api/credit-ledger?${q}`);
    if (ok) {
      setPartyReport(data.partyReport || []);
      setPartyOptions(data.partyOptions || []);
      setBranchOptions(data.branchOptions || []);
      setTotals(data.totals || { creditAmount: 0, paidAmount: 0, outstanding: 0 });
    } else {
      toast.error(data.message || "تعذّر تحميل الديون والأجل");
    }
    setLoading(false);
  };

  const loadParties = async () => {
    const url = tab === "supplier" ? "/api/suppliers?kind=wholesale" : "/api/customers";
    const { ok, data } = await apiJson<{ suppliers?: PartyOption[]; customers?: PartyOption[] }>(url);
    if (!ok) return;
    setParties(tab === "supplier" ? data.suppliers || [] : data.customers || []);
  };

  useEffect(() => {
    setSearch("");
    setSelectedPartyId("");
    setSelectedBranchId("");
  }, [tab]);

  useEffect(() => {
    if (!ready || !canAccessDebts) return;
    const t = setTimeout(() => {
      void loadLedger();
    }, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [ready, tab, onlyOutstanding, search, selectedPartyId, selectedBranchId, canAccessDebts]);

  useEffect(() => {
    if (!ready || !showAddModal) return;
    loadParties();
  }, [ready, tab, showAddModal]);

  const tabLabel = tab === "supplier" ? "الموردين" : "العملاء";
  const partyLabel = tab === "supplier" ? "المورد" : "العميل";

  const resetAddForm = () => {
    setAddForm({
      partyId: "",
      branchId: "",
      entryDate: todayInputValue(),
      creditAmount: "",
      paidAmount: "",
      notes: "",
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const creditAmount = Number(addForm.creditAmount);
    const paidAmount = addForm.paidAmount.trim() ? Number(addForm.paidAmount) : 0;

    if (!addForm.partyId) {
      toast.error(`اختر ${partyLabel}`);
      return;
    }
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      toast.error("أدخل مبلغ آجل صحيح");
      return;
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > creditAmount) {
      toast.error("المبلغ المدفوع غير صالح");
      return;
    }

    setShowAddConfirm(true);
  };

  const confirmAdd = async () => {
    const creditAmount = Number(addForm.creditAmount);
    const paidAmount = addForm.paidAmount.trim() ? Number(addForm.paidAmount) : 0;

    setSaving(true);
    try {
      const body =
        tab === "supplier"
          ? {
              partyType: tab,
              supplierId: addForm.partyId,
              branchId: addForm.branchId || null,
              entryDate: addForm.entryDate,
              creditAmount,
              paidAmount,
              notes: addForm.notes,
            }
          : {
              partyType: tab,
              customerId: addForm.partyId,
              branchId: addForm.branchId || null,
              entryDate: addForm.entryDate,
              creditAmount,
              paidAmount,
              notes: addForm.notes,
            };

      const { ok, data } = await runPendingOperation(() =>
        apiJson<{ message?: string }>("/api/credit-ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );

      if (!ok) {
        toast.error(data.message || "تعذّر إضافة السجل");
        return;
      }

      toast.success("تم إضافة سجل جديد");
      setShowAddConfirm(false);
      setShowAddModal(false);
      resetAddForm();
      loadLedger();
    } finally {
      setSaving(false);
    }
  };

  const selectedAddParty = parties.find((p) => p.id === addForm.partyId);
  const selectedAddBranch = branchOptions.find((b) => b.branchId === addForm.branchId);
  const pendingAddCredit = Number(addForm.creditAmount);
  const pendingAddPaid = addForm.paidAmount.trim() ? Number(addForm.paidAmount) : 0;

  const openPayModal = (row: PartyReportRow) => {
    setPayTarget(row);
    setPayAmount("");
    setPayNotes("");
    setPendingPayAmount(null);
    setShowPayConfirm(false);
    setShowPayModal(true);
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;

    const outstandingAmount = payTarget.outstanding;

    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("أدخل مبلغ دفعة صحيح");
      return;
    }
    if (amount > outstandingAmount) {
      toast.error("مبلغ الدفعة أكبر من الرصيد المستحق");
      return;
    }

    setPendingPayAmount(amount);
    setShowPayConfirm(true);
  };

  const confirmPayment = async () => {
    if (!payTarget || pendingPayAmount == null) return;

    setSaving(true);
    try {
      const { ok, data } = await runPendingOperation(() =>
        apiJson<{ message?: string }>("/api/credit-ledger/party", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partyType: tab,
            partyId: payTarget.partyId,
            branchId: payTarget.branchId,
            addPayment: pendingPayAmount,
            notes: payNotes.trim() || null,
          }),
        })
      );

      if (!ok) {
        toast.error(data.message || "تعذّر تسجيل الدفعة");
        return;
      }

      toast.success("تم تسجيل الدفعة");
      setShowPayConfirm(false);
      setShowPayModal(false);
      setPayTarget(null);
      setPayAmount("");
      setPayNotes("");
      setPendingPayAmount(null);
      loadLedger();
    } finally {
      setSaving(false);
    }
  };

  const openDetailsModal = async (row: PartyReportRow) => {
    setDetailsParty(row);
    setDetailsTimeline([]);
    setShowDetailsModal(true);
    setDetailsLoading(true);

    const q = new URLSearchParams({
      partyType: tab,
      partyId: row.partyId,
      branchId: branchQueryValue(row.branchId),
    });
    const { ok, data } = await apiJson<PartyDetailsResponse & { message?: string }>(
      `/api/credit-ledger/party?${q}`
    );
    setDetailsLoading(false);

    if (!ok) {
      toast.error(data.message || "تعذّر تحميل التفاصيل");
      setShowDetailsModal(false);
      return;
    }

    setDetailsParty({
      ...row,
      creditAmount: data.party.creditAmount,
      paidAmount: data.party.paidAmount,
      outstanding: data.party.outstanding,
      firstEntryDate: data.party.firstEntryDate,
    });
    setDetailsTimeline(data.timeline || []);
  };

  const kpiCards = useMemo(
    () => [
      {
        title: `إجمالي الآجل — ${tabLabel}`,
        value: totals.creditAmount,
        variant: "expenses" as const,
        emoji: "📋",
        subtitle: "مجموع الديون والأجل المسجّلة",
      },
      {
        title: `إجمالي المدفوع — ${tabLabel}`,
        value: totals.paidAmount,
        variant: "profit" as const,
        emoji: "✅",
        subtitle: "ما تم سداده حتى الآن",
      },
      {
        title: `الرصيد المستحق — ${tabLabel}`,
        value: totals.outstanding,
        variant: "invoices" as const,
        emoji: em.issue,
        subtitle: "المبلغ المتبقي على الشركة",
      },
    ],
    [totals, tabLabel]
  );

  if (!ready) return null;

  if (!canAccessDebts) {
    return (
      <div className="glass-card p-10 text-center text-muted">
        ليس لديك صلاحية الوصول إلى شاشة الديون والأجل.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="الديون والأجل"
        subtitle="سجل مستقل على مستوى الشركة — غير مرتبط بحسابات الفروع"
        hideMobileMenu
      />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div className="flex p-1 rounded-xl bg-background-input/60 border border-border w-fit">
          {(["supplier", "customer"] as PartyType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                tab === key
                  ? "bg-primary/25 text-white border border-primary/40 shadow-glow-sm"
                  : "text-muted hover:text-white"
              )}
            >
              {key === "supplier" ? "الموردين" : "العملاء"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOutstanding}
              onChange={(e) => setOnlyOutstanding(e.target.checked)}
              className="rounded border-border"
            />
            المستحق فقط
          </label>

          <div className="flex p-1 rounded-xl bg-background-input/40 border border-border">
            <button
              type="button"
              onClick={() => setView("detail")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                view === "detail" ? "bg-white/10 text-white" : "text-muted"
              )}
            >
              تفصيلي
            </button>
            <button
              type="button"
              onClick={() => setView("summary")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                view === "summary" ? "bg-white/10 text-white" : "text-muted"
              )}
            >
              تقرير مجمع
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              resetAddForm();
              setShowAddConfirm(false);
              setShowAddModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <span aria-hidden>{em.add}</span>
            إضافة دين / أجل
          </button>
        </div>
      </div>

      <div className="glass-card p-4 mb-5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark inline-flex items-center justify-center text-lg leading-none pointer-events-none"
              aria-hidden
            >
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`بحث باسم ${partyLabel} أو الهاتف أو الفرع...`}
              className={cn(filterFieldClass, "pr-10 pl-4")}
            />
          </div>
          <div className="w-full sm:w-72 shrink-0">
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className={cn(filterFieldClass, "px-4")}
            >
              <option value="">كل {tabLabel}</option>
              {partyOptions.map((p) => (
                <option key={p.partyId} value={p.partyId}>
                  {p.partyName}
                  {p.partyPhone ? ` — ${p.partyPhone}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-64 shrink-0">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className={cn(filterFieldClass, "px-4")}
            >
              <option value="">كل الفروع</option>
              <option value="__none__">بدون فرع</option>
              {branchOptions.map((branch) => (
                <option key={branch.branchId} value={branch.branchId}>
                  {branch.branchName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {kpiCards.map((card, index) => (
          <KpiCard
            key={card.title}
            variant={card.variant}
            delay={index * 80}
            title={card.title}
            value={card.value}
            suffix="ج.م"
            subtitle={card.subtitle}
            emoji={card.emoji}
          />
        ))}
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted animate-pulse">جاري التحميل...</div>
      ) : view === "summary" ? (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-white">تقرير مجمع — {tabLabel}</h2>
            <p className="text-xs text-muted mt-1">
              ملخص لكل {partyLabel} وفرع — إجمالي الآجل والمدفوع وعدد السجلات. الدفعة تُطبَّق على سجلات نفس الفرع فقط.
            </p>
          </div>
          <div className={ledgerTableViewportClass}>
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="text-xs text-muted-dark">
                  <ThEmoji emoji={tab === "supplier" ? em.supplier : em.customer} className={ledgerTableHeadCellClass}>
                    {partyLabel}
                  </ThEmoji>
                  <ThEmoji emoji={em.branch} className={ledgerTableHeadCellClass}>
                    الفرع
                  </ThEmoji>
                  <ThEmoji emoji={em.total} className={ledgerTableHeadCellClass}>
                    إجمالي الآجل
                  </ThEmoji>
                  <ThEmoji emoji={em.payment} className={ledgerTableHeadCellClass}>
                    إجمالي المدفوع
                  </ThEmoji>
                  <ThEmoji emoji={em.profitDown} className={ledgerTableHeadCellClass}>
                    الرصيد المستحق
                  </ThEmoji>
                  <ThEmoji emoji={em.number} className={ledgerTableHeadCellClass}>
                    عدد السجلات
                  </ThEmoji>
                  <ThEmoji emoji={em.actions} className={cn(ledgerTableHeadCellClass, "w-24")}>
                    إجراءات
                  </ThEmoji>
                </tr>
              </thead>
              <tbody>
                {partyReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted text-sm">
                      {emptyLedgerMessage(search, onlyOutstanding, tabLabel)}
                    </td>
                  </tr>
                ) : (
                  partyReport.map((row) => (
                    <tr key={row.reportKey} className="border-b border-border/60 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <CellEmoji emoji={tab === "supplier" ? em.supplier : em.customer}>
                          <div>
                            <p className="font-medium text-white">{row.partyName}</p>
                            {row.partyPhone ? (
                              <p className="text-xs text-muted mt-0.5">{row.partyPhone}</p>
                            ) : null}
                          </div>
                        </CellEmoji>
                      </td>
                      <td className="p-4 text-sm text-muted">{branchDisplayName(row.branchName)}</td>
                      <td className="p-4 tabular-nums text-accent-orange">{formatAmountExact(row.creditAmount)}</td>
                      <td className="p-4 tabular-nums text-accent-green">{formatAmountExact(row.paidAmount)}</td>
                      <td className="p-4 tabular-nums font-semibold text-primary-light">
                        {formatAmountExact(row.outstanding)}
                      </td>
                      <td className="p-4 tabular-nums text-muted">{row.entryCount}</td>
                      <td className="p-4">
                        {row.outstanding > 0.0001 ? (
                          <ActionEmoji
                            emoji="💵"
                            title="تسجيل دفعة على إجمالي المستحق"
                            onClick={() => openPayModal(row)}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-white">سجل تفصيلي — {tabLabel}</h2>
            <p className="text-xs text-muted mt-1">
              سطر لكل {partyLabel} وفرع — اضغط «عرض» لرؤية حركات نفس الفرع فقط
            </p>
          </div>
          <div className={ledgerTableViewportClass}>
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="text-xs text-muted-dark">
                  <ThEmoji emoji={em.date} className={ledgerTableHeadCellClass}>
                    التاريخ
                  </ThEmoji>
                  <ThEmoji emoji={tab === "supplier" ? em.supplier : em.customer} className={ledgerTableHeadCellClass}>
                    {partyLabel}
                  </ThEmoji>
                  <ThEmoji emoji={em.branch} className={ledgerTableHeadCellClass}>
                    الفرع
                  </ThEmoji>
                  <ThEmoji emoji={em.total} className={ledgerTableHeadCellClass}>
                    إجمالي الآجل
                  </ThEmoji>
                  <ThEmoji emoji={em.payment} className={ledgerTableHeadCellClass}>
                    إجمالي المدفوع
                  </ThEmoji>
                  <ThEmoji emoji={em.profitDown} className={ledgerTableHeadCellClass}>
                    الرصيد المستحق
                  </ThEmoji>
                  <ThEmoji emoji={em.view} className={ledgerTableHeadCellClass}>
                    إجراءات
                  </ThEmoji>
                </tr>
              </thead>
              <tbody>
                {partyReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted text-sm">
                      {emptyLedgerMessage(search, onlyOutstanding, tabLabel)}
                    </td>
                  </tr>
                ) : (
                  partyReport.map((row) => (
                    <tr key={row.reportKey} className="border-b border-border/60 hover:bg-white/[0.02]">
                      <td className="p-4 text-sm text-muted">{formatLedgerDate(row.lastActivityDate)}</td>
                      <td className="p-4">
                        <CellEmoji emoji={tab === "supplier" ? em.supplier : em.customer}>
                          <div>
                            <p className="font-medium text-white">{row.partyName}</p>
                            {row.partyPhone ? (
                              <p className="text-xs text-muted mt-0.5">{row.partyPhone}</p>
                            ) : null}
                          </div>
                        </CellEmoji>
                      </td>
                      <td className="p-4 text-sm text-muted">{branchDisplayName(row.branchName)}</td>
                      <td className="p-4 tabular-nums text-accent-orange">{formatAmountExact(row.creditAmount)}</td>
                      <td className="p-4 tabular-nums text-accent-green">{formatAmountExact(row.paidAmount)}</td>
                      <td className="p-4 tabular-nums font-semibold text-primary-light">
                        {formatAmountExact(row.outstanding)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <ActionEmoji
                            emoji={em.view}
                            title="عرض كل الحركات"
                            onClick={() => openDetailsModal(row)}
                          />
                          {row.outstanding > 0.0001 ? (
                            <ActionEmoji
                              emoji="💵"
                              title="تسجيل دفعة"
                              onClick={() => openPayModal(row)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white">إضافة دين / أجل — {tabLabel}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted hover:text-white text-xl leading-none"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs text-muted mb-1.5 block">{partyLabel}</label>
                <select
                  required
                  value={addForm.partyId}
                  onChange={(e) => setAddForm({ ...addForm, partyId: e.target.value })}
                  className="glass-input w-full"
                >
                  <option value="">اختر {partyLabel}</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                      {p.phone ? ` — ${p.phone}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">الفرع (اختياري — للتذكّر فقط)</label>
                <select
                  value={addForm.branchId}
                  onChange={(e) => setAddForm({ ...addForm, branchId: e.target.value })}
                  className="glass-input w-full"
                >
                  <option value="">بدون فرع</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.branchId} value={branch.branchId}>
                      {branch.branchName}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted mt-1.5">
                  للتذكّر بمكان الزيارة فقط — لا يؤثر على حسابات الفروع الداخلية
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1.5 block">التاريخ</label>
                  <input
                    type="date"
                    required
                    value={addForm.entryDate}
                    onChange={(e) => setAddForm({ ...addForm, entryDate: e.target.value })}
                    className="glass-input w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1.5 block">المبلغ الآجل</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={addForm.creditAmount}
                    onChange={(e) => setAddForm({ ...addForm, creditAmount: e.target.value })}
                    className="glass-input w-full"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">المبلغ المدفوع (اختياري)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.paidAmount}
                  onChange={(e) => setAddForm({ ...addForm, paidAmount: e.target.value })}
                  className="glass-input w-full"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-xs text-muted mb-1.5 block">ملاحظات</label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="glass-input w-full min-h-[72px] resize-y"
                  placeholder="اختياري"
                  maxLength={500}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddConfirm(false);
                    setShowAddModal(false);
                  }}
                  className="btn-secondary flex-1"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Modal
        open={showAddConfirm && selectedAddParty != null}
        onClose={() => !saving && setShowAddConfirm(false)}
        title="تأكيد إضافة دين / أجل"
        size="sm"
      >
        {selectedAddParty ? (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">
              هل تريد تسجيل{" "}
              {tab === "supplier" ? "دين" : "آجل"} بقيمة{" "}
              <span className="text-accent-orange font-bold tabular-nums">
                {formatAmountExact(pendingAddCredit)} ج.م
              </span>{" "}
              لـ{" "}
              <span className="text-white font-semibold">{selectedAddParty.nameAr}</span>؟
            </p>
            <div className="rounded-xl border border-border bg-background-input/40 p-3 text-sm space-y-1">
              <p className="text-muted">
                التاريخ:{" "}
                <span className="text-white">{formatLedgerDate(addForm.entryDate)}</span>
              </p>
              <p className="text-muted">
                الفرع:{" "}
                <span className="text-white">
                  {selectedAddBranch?.branchName ?? "بدون فرع"}
                </span>
              </p>
              <p className="text-muted">
                المبلغ الآجل:{" "}
                <span className="text-accent-orange font-semibold tabular-nums">
                  {formatAmountExact(pendingAddCredit)} ج.م
                </span>
              </p>
              {pendingAddPaid > 0.0001 ? (
                <p className="text-muted">
                  المبلغ المدفوع:{" "}
                  <span className="text-accent-green font-semibold tabular-nums">
                    {formatAmountExact(pendingAddPaid)} ج.م
                  </span>
                </p>
              ) : null}
              {pendingAddPaid > 0.0001 ? (
                <p className="text-muted">
                  يُضاف على الرصيد:{" "}
                  <span className="text-primary-light font-semibold tabular-nums">
                    {formatAmountExact(pendingAddCredit - pendingAddPaid)} ج.م
                  </span>
                </p>
              ) : null}
              {addForm.notes.trim() ? (
                <p className="text-muted pt-1 border-t border-border/60">
                  الملاحظات: <span className="text-white">{addForm.notes.trim()}</span>
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                disabled={saving}
                onClick={() => setShowAddConfirm(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2"
                disabled={saving}
                onClick={() => void confirmAdd()}
              >
                {saving ? "جاري الحفظ..." : "تأكيد الإضافة"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {showDetailsModal && detailsParty ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">تفاصيل الحساب — {detailsParty.partyName}</h3>
                <p className="text-sm text-muted mt-1">
                  الفرع: {branchDisplayName(detailsParty.branchName)} — {detailsParty.entryCount} سجل — أول
                  تسجيل: {formatLedgerDate(detailsParty.firstEntryDate)}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                  <span>
                    الآجل:{" "}
                    <span className="text-accent-orange tabular-nums font-medium">
                      {formatAmountExact(detailsParty.creditAmount)} ج.م
                    </span>
                  </span>
                  <span>
                    المدفوع:{" "}
                    <span className="text-accent-green tabular-nums font-medium">
                      {formatAmountExact(detailsParty.paidAmount)} ج.م
                    </span>
                  </span>
                  <span>
                    المستحق:{" "}
                    <span className="text-primary-light tabular-nums font-semibold">
                      {formatAmountExact(detailsParty.outstanding)} ج.م
                    </span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="text-muted hover:text-white text-xl leading-none"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {detailsLoading ? (
                <p className="text-center text-muted py-8 animate-pulse">جاري تحميل السجل...</p>
              ) : detailsTimeline.length === 0 ? (
                <p className="text-center text-muted py-8">لا توجد حركات مسجّلة</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="text-xs text-muted-dark border-b border-border">
                        <th className="text-right p-3 font-medium">التاريخ</th>
                        <th className="text-right p-3 font-medium">الحركة</th>
                        <th className="text-right p-3 font-medium">مبلغ الدين</th>
                        <th className="text-right p-3 font-medium">المبلغ المدفوع</th>
                        <th className="text-right p-3 font-medium">الرصيد بعدها</th>
                        <th className="text-right p-3 font-medium">بواسطة</th>
                        <th className="text-right p-3 font-medium">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsTimeline.map((event) => (
                        <tr key={event.id} className="border-b border-border/50">
                          <td className="p-3 text-sm text-muted leading-snug">
                            <div className="whitespace-nowrap">{formatLedgerDate(event.date)}</div>
                            <div className="whitespace-nowrap text-xs text-muted-dark tabular-nums mt-0.5">
                              {formatLedgerTime(event.date)}
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-sm font-medium",
                                event.type === "credit"
                                  ? "text-accent-orange"
                                  : event.type === "payment"
                                    ? "text-accent-green"
                                    : "text-white"
                              )}
                            >
                              <span aria-hidden>
                                {event.type === "credit"
                                  ? "📌"
                                  : event.type === "payment"
                                    ? "💵"
                                    : "📋"}
                              </span>
                              {event.label}
                            </span>
                          </td>
                          <td className="p-3 tabular-nums text-accent-orange font-medium">
                            {event.type === "credit" || event.type === "combined"
                              ? formatAmountExact(event.creditAmount ?? event.amount)
                              : "—"}
                          </td>
                          <td className="p-3 tabular-nums text-accent-green font-medium">
                            {event.type === "payment" || event.type === "combined"
                              ? formatAmountExact(event.paidAmount ?? event.amount)
                              : "—"}
                          </td>
                          <td className="p-3 tabular-nums text-primary-light font-semibold">
                            {formatAmountExact(event.balanceAfter)}
                          </td>
                          <td className="p-3 text-sm text-muted whitespace-nowrap">
                            {event.recordedByName || "—"}
                          </td>
                          <td className="p-3 text-sm text-muted max-w-[180px] truncate">
                            {event.notes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showPayModal && payTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">تسجيل دفعة</h3>
            <p className="text-sm text-muted">
              {payTarget.partyName} — {branchDisplayName(payTarget.branchName)} — مستحق:{" "}
              <span className="text-primary-light font-semibold tabular-nums">
                {formatAmountExact(payTarget.outstanding)} ج.م
              </span>
              <span className="block text-xs mt-1">
                تُطبَّق الدفعة على سجلات نفس الفرع فقط ({payTarget.entryCount} سجل)
              </span>
            </p>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="text-xs text-muted mb-1.5 block">مبلغ الدفعة</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max={payTarget.outstanding}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="glass-input w-full"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">ملاحظات (اختياري)</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="glass-input w-full min-h-[80px] resize-y"
                  placeholder="مثال: دفعة جزئية — شيك رقم 123"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  تسجيل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPayConfirm(false);
                    setShowPayModal(false);
                  }}
                  className="btn-secondary flex-1"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Modal
        open={showPayConfirm && payTarget != null && pendingPayAmount != null}
        onClose={() => !saving && setShowPayConfirm(false)}
        title="تأكيد تسجيل الدفعة"
        size="sm"
      >
        {payTarget && pendingPayAmount != null ? (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">
              هل تريد تسجيل دفعة بقيمة{" "}
              <span className="text-accent-green font-bold tabular-nums">
                {formatAmountExact(pendingPayAmount)} ج.م
              </span>{" "}
              لـ{" "}
              <span className="text-white font-semibold">{payTarget.partyName}</span>
              <> — {branchDisplayName(payTarget.branchName)} — {payTarget.entryCount} سجل</>
              ؟
            </p>
            <div className="rounded-xl border border-border bg-background-input/40 p-3 text-sm space-y-1">
              <p className="text-muted">
                الرصيد المستحق قبل الدفعة:{" "}
                <span className="text-primary-light font-semibold tabular-nums">
                  {formatAmountExact(payTarget.outstanding)} ج.م
                </span>
              </p>
              <p className="text-muted">
                الرصيد بعد الدفعة:{" "}
                <span className="text-white font-semibold tabular-nums">
                  {formatAmountExact(payTarget.outstanding - pendingPayAmount)} ج.م
                </span>
              </p>
              {payNotes.trim() ? (
                <p className="text-muted pt-1 border-t border-border/60">
                  الملاحظات: <span className="text-white">{payNotes.trim()}</span>
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                disabled={saving}
                onClick={() => setShowPayConfirm(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary px-4 py-2"
                disabled={saving}
                onClick={() => void confirmPayment()}
              >
                {saving ? "جاري التسجيل..." : "تأكيد الدفعة"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
