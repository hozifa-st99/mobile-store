import { sanitizeBranchCode } from "@/lib/branch-code";

/** رقم مستند إدخال رصيد — OB-XXX-00000001 */
export const STOCK_ENTRY_PREFIX = "OB-";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatStockEntryDocumentNumber(branchCode: string, seq: number): string {
  const code = sanitizeBranchCode(branchCode);
  return `${STOCK_ENTRY_PREFIX}${code}-${String(seq).padStart(8, "0")}`;
}

export function parseStockEntryDocumentSeq(
  documentNumber: string,
  branchCode?: string
): number | null {
  const trimmed = documentNumber.trim();
  if (!trimmed.startsWith(STOCK_ENTRY_PREFIX)) return null;
  const rest = trimmed.slice(STOCK_ENTRY_PREFIX.length);

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
