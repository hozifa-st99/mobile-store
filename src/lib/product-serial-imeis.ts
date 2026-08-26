/** أرقام الجهاز — دوال آمنة للعميل والخادم */

import { formatImeisSnapshot, parseImeisSnapshot } from "@/lib/purchase-return-number";

const IMEI_PATTERN = /^\d{8,20}$/;

export function isValidImeiFormat(imei: string): boolean {
  return IMEI_PATTERN.test(imei.trim());
}

export function validateDeviceImeis(imeis: string[]): void {
  for (const imei of imeis) {
    if (!isValidImeiFormat(imei)) {
      throw new Error(`IMEI_INVALID:${imei}`);
    }
  }
}

export function normalizeDeviceImeis(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    const imei = value?.trim();
    if (!imei || seen.has(imei)) continue;
    seen.add(imei);
    list.push(imei);
  }
  return list;
}

export function normalizeAndValidateDeviceImeis(
  values: Array<string | null | undefined>
): string[] {
  const imeis = normalizeDeviceImeis(values);
  validateDeviceImeis(imeis);
  return imeis;
}
export function getDeviceImeis(
  serial: { imeiEntries?: Array<{ imei: string }> | null } | null | undefined
): string[] {
  if (!serial?.imeiEntries?.length) return [];
  return normalizeDeviceImeis(serial.imeiEntries.map((entry) => entry.imei));
}

export function getPrimaryDeviceImei(
  serial: { imeiEntries?: Array<{ imei: string }> | null } | null | undefined
): string | null {
  return getDeviceImeis(serial)[0] ?? null;
}

export function formatDeviceImeisLabel(imeis: string[]): string {
  if (imeis.length === 0) return "—";
  if (imeis.length === 1) return imeis[0];
  return imeis.join(" · ");
}

/** حفظ كل IMEIs الجهاز في حقل واحد (فاصلة) */
export function formatDeviceImeisSnapshot(imeis: string[]): string | null {
  return formatImeisSnapshot(imeis);
}

/** عرض IMEI محفوظ — snapshot أو نص قديم */
export function formatStoredDeviceImeis(stored: string | null | undefined): string {
  const imeis = parseImeisSnapshot(stored);
  if (imeis.length > 0) return formatDeviceImeisLabel(imeis);
  const trimmed = stored?.trim();
  if (!trimmed || trimmed === "—") return "—";
  return trimmed;
}

/** أول IMEI للبحث — من snapshot أو النص */
export function getLookupImeiFromStored(stored: string | null | undefined): string | null {
  const imeis = parseImeisSnapshot(stored);
  if (imeis.length > 0) return imeis[0];
  return stored?.trim() || null;
}

export function getStoredDeviceImeis(stored: string | null | undefined): string[] {
  const parsed = parseImeisSnapshot(stored);
  if (parsed.length > 0) return parsed;
  const trimmed = stored?.trim();
  return trimmed ? [trimmed] : [];
}

export function deviceImeisMatch(
  serial: { imeiEntries?: Array<{ imei: string }> | null } | null | undefined,
  imei: string | null | undefined
): boolean {
  const needle = imei?.trim();
  if (!needle) return false;
  return getDeviceImeis(serial).includes(needle);
}
