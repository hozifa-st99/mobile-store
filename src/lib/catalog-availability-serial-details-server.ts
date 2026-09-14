import type { PrismaClient } from "@prisma/client";

import {
  mapSerialToPhoneDeviceRow,
  phoneSerialDetailsInclude,
  toSalePhoneDeviceRow,
  type SalePhoneDeviceRow,
} from "@/lib/phone-device-serial-details";
import { serialBelongsToProduct } from "@/lib/phone-serial-product-filter";

export type { SalePhoneDeviceRow };

/**
 * تفاصيل جهاز متاح في أي فرع (نفس الشركة) — للاستعلام عن المخزون فقط.
 * نفس شروط catalog-availability/serials: available + منتج هاتف نشط.
 */
export async function loadCatalogAvailabilitySerialDetails(
  prisma: PrismaClient,
  companyId: string,
  serialId: string
): Promise<SalePhoneDeviceRow | null> {
  const serialMeta = await prisma.productSerial.findFirst({
    where: {
      id: serialId,
      status: "available",
      product: {
        companyId,
        deletedAt: null,
        isActive: true,
        type: "phone",
      },
    },
    select: { id: true, branchId: true, productId: true },
  });

  if (!serialMeta) return null;

  const serial = await prisma.productSerial.findUnique({
    where: { id: serialMeta.id },
    include: phoneSerialDetailsInclude(serialMeta.branchId),
  });

  if (!serial || !serialBelongsToProduct(serial, serial.productId)) {
    return null;
  }

  return toSalePhoneDeviceRow(mapSerialToPhoneDeviceRow(serial));
}
