/** لقطة أجهزة الجرد — تُحفظ مع المستند لعرض IMEI/باركود/تكلفة كل جهاز كما في الجرد */

export interface StocktakeSerialSnapshot {
  id: string;
  imei: string | null;
  imeis: string[];
  barcode: string | null;
  unitCost: number;
  present: boolean;
}

function normalizeSnapshotEntry(raw: unknown): StocktakeSerialSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;

  const imeis = Array.isArray(row.imeis)
    ? row.imeis.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const imei =
    typeof row.imei === "string" && row.imei.trim()
      ? row.imei.trim()
      : imeis[0] ?? null;

  return {
    id,
    imei,
    imeis: imeis.length > 0 ? imeis : imei ? [imei] : [],
    barcode: typeof row.barcode === "string" && row.barcode.trim() ? row.barcode.trim() : null,
    unitCost: Number(row.unitCost) || 0,
    present: row.present !== false,
  };
}

export function serializeStocktakeSerials(
  serials: StocktakeSerialSnapshot[]
): string | null {
  if (serials.length === 0) return null;
  return JSON.stringify(serials);
}

export function parseStocktakeSerials(
  stored: string | null | undefined
): StocktakeSerialSnapshot[] {
  if (!stored?.trim()) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeSnapshotEntry)
      .filter((row): row is StocktakeSerialSnapshot => row != null);
  } catch {
    return [];
  }
}

export function stocktakeSerialsToLineSerials(
  snapshots: StocktakeSerialSnapshot[],
  productId: string
) {
  return snapshots.map((serial) => ({
    id: serial.id,
    productId,
    imei:
      serial.imei ||
      (serial.imeis.length > 0 ? serial.imeis.join(" · ") : null),
    imeis: serial.imeis,
    barcode: serial.barcode,
    unitCost: serial.unitCost,
    present: serial.present,
  }));
}

export function resolveSavedStocktakeSerials(
  productId: string,
  options: {
    serials?: Array<{
      id: string;
      productId?: string;
      imei: string | null;
      imeis?: string[];
      barcode: string | null;
      unitCost: number;
      present?: boolean;
    }>;
    serialsSnapshot?: string | null;
  }
) {
  if (options.serials?.length) {
    return options.serials.map((serial) => ({
      id: serial.id,
      productId: serial.productId ?? productId,
      imei: serial.imei,
      imeis: serial.imeis ?? (serial.imei ? [serial.imei] : []),
      barcode: serial.barcode,
      unitCost: serial.unitCost,
      present: serial.present !== false,
    }));
  }

  const parsed = parseStocktakeSerials(options.serialsSnapshot);
  if (parsed.length === 0) return [];
  return stocktakeSerialsToLineSerials(parsed, productId);
}
