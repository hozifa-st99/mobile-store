import { sanitizeBranchCode } from "@/lib/branch-code";

/** رقم مرتجع مبيعات — SRET-MAD-00000001 */

export const SRET_PREFIX = "SRET-";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatSaleReturnNumber(branchCode: string, seq: number): string {
  const code = sanitizeBranchCode(branchCode);
  return `${SRET_PREFIX}${code}-${String(seq).padStart(8, "0")}`;
}

export function parseSaleReturnSeq(
  returnNumber: string,
  branchCode?: string
): number | null {
  const trimmed = returnNumber.trim();
  if (!trimmed.startsWith(SRET_PREFIX)) return null;
  const rest = trimmed.slice(SRET_PREFIX.length);

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
