import { sanitizeBranchCode } from "@/lib/branch-code";

/** رقم مرتجع مشتريات — PRET-MAD-00000001 */

export const PRET_PREFIX = "PRET-";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatPurchaseReturnNumber(branchCode: string, seq: number): string {
  const code = sanitizeBranchCode(branchCode);
  return `${PRET_PREFIX}${code}-${String(seq).padStart(8, "0")}`;
}

export function parsePurchaseReturnSeq(
  returnNumber: string,
  branchCode?: string
): number | null {
  const trimmed = returnNumber.trim();
  if (!trimmed.startsWith(PRET_PREFIX)) return null;
  const rest = trimmed.slice(PRET_PREFIX.length);

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

export function parseImeisSnapshot(snapshot: string | null | undefined): string[] {
  if (!snapshot?.trim()) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const part of snapshot.split(/[,/|]/)) {
    const imei = part.trim();
    if (!imei || seen.has(imei)) continue;
    seen.add(imei);
    list.push(imei);
  }
  return list;
}

export function formatImeisSnapshot(imeis: string[]): string | null {
  const list = imeis.map((i) => i.trim()).filter(Boolean);
  return list.length > 0 ? list.join(",") : null;
}
