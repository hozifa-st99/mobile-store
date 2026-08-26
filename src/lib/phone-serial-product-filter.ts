/** Client-safe helpers — keep separate from phone-product-serials (Prisma / server-only). */

export function serialBelongsToProduct(
  serial: {
    purchaseItem: { productId: string | null } | null;
    stockEntryItem: { productId: string | null } | null;
  },
  productId: string
) {
  if (
    serial.purchaseItem?.productId != null &&
    serial.purchaseItem.productId !== productId
  ) {
    return false;
  }
  if (
    serial.stockEntryItem?.productId != null &&
    serial.stockEntryItem.productId !== productId
  ) {
    return false;
  }
  return true;
}

export function filterPhoneSerialsForProduct<
  T extends Parameters<typeof serialBelongsToProduct>[0],
>(serials: T[], productId: string): T[] {
  return serials.filter((serial) => serialBelongsToProduct(serial, productId));
}
