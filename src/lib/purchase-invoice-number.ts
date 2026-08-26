import { sanitizeBranchCode } from "@/lib/branch-code";

/** رقم فاتورة شراء — تسلسل فريد مع كود الفرع: PUR-MAD-00000001 */

export const PUR_INVOICE_PREFIX = "PUR-";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatPurchaseInvoiceNumber(branchCode: string, seq: number): string {
  const code = sanitizeBranchCode(branchCode);
  return `${PUR_INVOICE_PREFIX}${code}-${String(seq).padStart(8, "0")}`;
}

/** يقرأ التسلسل — يدعم الشكل الجديد PUR-XXX-00000001 والقديم PUR-00000001 */
export function parsePurchaseInvoiceSeq(
  invoiceNumber: string,
  branchCode?: string
): number | null {
  const trimmed = invoiceNumber.trim();
  if (!trimmed.startsWith(PUR_INVOICE_PREFIX)) return null;
  const rest = trimmed.slice(PUR_INVOICE_PREFIX.length);

  if (branchCode) {
    const code = escapeRegex(sanitizeBranchCode(branchCode));
    const coded = rest.match(new RegExp(`^${code}-(\\d+)$`));
    if (coded) {
      const n = parseInt(coded[1], 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  }

  // الشكل القديم: PUR-00000001 (8 أرقام)
  if (/^\d{8}$/.test(rest)) {
    const n = parseInt(rest, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  return null;
}
