/** يفصل ملاحظات المستخدم عن سطر مصاريف الفاتورة المحفوظ في notes */

export function splitExpenseNotes(notes: string | null | undefined): {
  userNotes: string;
  expenseLine: string | null;
} {
  if (!notes?.trim()) return { userNotes: "", expenseLine: null };
  const marker = "مصاريف الفاتورة:";
  const idx = notes.indexOf(marker);
  if (idx === -1) return { userNotes: notes.trim(), expenseLine: null };
  return {
    userNotes: notes.slice(0, idx).trim(),
    expenseLine: notes.slice(idx).trim(),
  };
}

/** يجمع مبالغ مصاريف الفاتورة من سطر notes مثل: «مصاريف الفاتورة: شحن (15 ج.م) | تأمين (5 ج.م)» */
export function parseInvoiceExpenseTotal(expenseLine: string | null | undefined): number {
  if (!expenseLine?.trim()) return 0;
  const re = /\(([\d.,]+)\s*ج\.?\s*م\.?\)/g;
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(expenseLine)) !== null) {
    const n = parseFloat(match[1].replace(/,/g, "."));
    if (Number.isFinite(n)) total += n;
  }
  return Math.round(total * 100) / 100;
}
