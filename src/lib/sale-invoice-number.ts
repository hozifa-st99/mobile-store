import { sanitizeBranchCode } from "@/lib/branch-code";

/** رقم فاتورة بيع — SAL-MAD-00000001 */

export const SAL_INVOICE_PREFIX = "SAL-";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatSaleInvoiceNumber(branchCode: string, seq: number): string {
  const code = sanitizeBranchCode(branchCode);
  return `${SAL_INVOICE_PREFIX}${code}-${String(seq).padStart(8, "0")}`;
}

export function parseSaleInvoiceSeq(
  invoiceNumber: string,
  branchCode?: string
): number | null {
  const trimmed = invoiceNumber.trim();
  if (!trimmed.startsWith(SAL_INVOICE_PREFIX)) return null;
  const rest = trimmed.slice(SAL_INVOICE_PREFIX.length);

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
