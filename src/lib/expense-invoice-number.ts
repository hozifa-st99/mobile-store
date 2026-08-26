import { sanitizeBranchCode } from "@/lib/branch-code";

/** رقم فاتورة مصروف — EXP-MAD-00000001 */

export const EXP_INVOICE_PREFIX = "EXP-";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatExpenseInvoiceNumber(branchCode: string, seq: number): string {
  const code = sanitizeBranchCode(branchCode);
  return `${EXP_INVOICE_PREFIX}${code}-${String(seq).padStart(8, "0")}`;
}

export function parseExpenseInvoiceSeq(
  invoiceNumber: string,
  branchCode?: string
): number | null {
  const trimmed = invoiceNumber.trim();
  if (!trimmed.startsWith(EXP_INVOICE_PREFIX)) return null;
  const rest = trimmed.slice(EXP_INVOICE_PREFIX.length);

  if (branchCode) {
    const code = escapeRegex(sanitizeBranchCode(branchCode));
    const coded = rest.match(new RegExp(`^${code}-(\\d+)$`));
    if (coded) {
      const n = parseInt(coded[1], 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }

  if (/^\d{8}$/.test(rest)) {
    const n = parseInt(rest, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  return null;
}
