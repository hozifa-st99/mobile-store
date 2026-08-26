import { isValidImeiFormat } from "@/lib/product-serial-imeis";

export interface ImeiCyclePreview {
  nextCycleIndex: number;
  isReEntry: boolean;
  blocked: boolean;
  blockedReason?: string;
  lastStatus?: string;
  message: string | null;
  /** IMEI2 من آخر دورة — للاقتراح فقط، لا يُطبَّق تلقائياً */
  suggestedSecondaryImei?: string | null;
}

export function canShowDualSimSuggestion(
  preview: ImeiCyclePreview | null,
  imeis: string[]
): preview is ImeiCyclePreview & { suggestedSecondaryImei: string } {
  if (!preview?.suggestedSecondaryImei || preview.blocked || !preview.isReEntry) {
    return false;
  }
  const trimmed = imeis.map((value) => value.trim());
  const filled = trimmed.filter(Boolean);
  if (filled.length >= 2) return false;
  const secondSlot = trimmed[1]?.trim();
  if (secondSlot && isValidImeiFormat(secondSlot)) return false;
  return true;
}

export function applySuggestedSecondaryImei(imeis: string[], suggested: string): string[] {
  const primary = imeis[0] ?? "";
  if (imeis.length >= 2) {
    const next = [...imeis];
    next[1] = suggested;
    return next;
  }
  return [primary, suggested];
}
