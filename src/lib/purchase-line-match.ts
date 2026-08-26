/** يطابق بنود الفاتورة المُنشأة مع الصفوف المحلّلة — لا يعتمد على ترتيب Prisma */
export function matchPurchaseLinesToResolved<
  T extends {
    id: string;
    productId: string | null;
    unitPrice: number;
    barcode: string | null;
    description: string;
  },
  R extends {
    productId: string | null;
    unitPrice: number;
    barcode: string | null;
    description: string;
  },
>(resolved: R[], lines: T[]): T[] {
  const pool = [...lines];
  const matched: T[] = [];

  for (const row of resolved) {
    const index = pool.findIndex((line) => {
      if (row.productId && line.productId !== row.productId) return false;
      if (Math.abs(line.unitPrice - row.unitPrice) > 0.001) return false;

      const rowBarcode = row.barcode?.trim() || null;
      const lineBarcode = line.barcode?.trim() || null;
      if (rowBarcode && lineBarcode && rowBarcode !== lineBarcode) return false;

      return true;
    });

    if (index === -1) {
      throw new Error("PURCHASE_LINE_MATCH_FAILED");
    }

    matched.push(pool.splice(index, 1)[0]!);
  }

  if (pool.length > 0) {
    throw new Error("PURCHASE_LINE_MATCH_FAILED");
  }

  return matched;
}
