/** ألوان شارات عمود النوع — موحّدة بين تقفيل الوردية وخزنة الفرع */
export const TRANSACTION_TYPE_BADGE_CLASS: Record<string, string> = {
  sale: "bg-accent-green/15 text-accent-green border-accent-green/30",
  sale_return: "bg-red-500/15 text-red-400 border-red-500/30",
  purchase: "bg-primary/15 text-primary-light border-primary/30",
  purchase_debt_payment: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  purchase_return: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  purchase_receivable_collection: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  purchase_return_expense_recovery: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  expense: "bg-accent-orange/15 text-accent-orange border-accent-orange/30",
  open_shift_deposit: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  shift_deposit: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  purchase_payment: "bg-primary/15 text-primary-light border-primary/30",
};

export function transactionTypeBadgeClass(type: string): string {
  return TRANSACTION_TYPE_BADGE_CLASS[type] || "bg-white/10 text-white border-white/10";
}
