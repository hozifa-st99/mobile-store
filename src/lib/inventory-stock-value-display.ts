import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "branchInventory" | "productSerial">;

export interface StockValueBreakdownRow {
  id: string;
  label: string;
  quantity: number;
  value: number;
}

export interface InventoryStockValueSnapshot {
  totalValue: number;
  phoneValue: number;
  accessoryValue: number;
  phoneQuantity: number;
  accessoryQuantity: number;
  phonesByBrand: StockValueBreakdownRow[];
  accessoriesByCategory: StockValueBreakdownRow[];
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** قراءة وتجميع عرض فقط — نفس منطق تكلفة المخzون في التقارير (موبايل = سيريالات available، إكسسوار = كمية × سعر شراء). */
export async function computeInventoryStockValueSnapshot(
  db: Db,
  branchId: string,
  companyId: string
): Promise<InventoryStockValueSnapshot> {
  const [inventories, phoneSerialCosts] = await Promise.all([
    db.branchInventory.findMany({
      where: {
        branchId,
        product: {
          deletedAt: null,
          isActive: true,
          companyId,
          type: { in: ["phone", "accessory"] },
        },
      },
      include: {
        product: {
          select: {
            type: true,
            phoneBrandId: true,
            phoneBrand: { select: { nameAr: true } },
            brand: true,
            itemCategoryId: true,
            itemCategory: { select: { nameAr: true } },
          },
        },
      },
    }),
    db.productSerial.findMany({
      where: {
        branchId,
        status: "available",
        product: {
          deletedAt: null,
          isActive: true,
          companyId,
          type: "phone",
        },
      },
      select: {
        productId: true,
        unitCost: true,
        product: {
          select: {
            phoneBrandId: true,
            phoneBrand: { select: { nameAr: true } },
            brand: true,
          },
        },
      },
    }),
  ]);

  const phoneBrandMap = new Map<string, StockValueBreakdownRow>();
  let phoneValue = 0;
  let phoneQuantity = 0;

  for (const serial of phoneSerialCosts) {
    const label =
      serial.product.phoneBrand?.nameAr?.trim() ||
      serial.product.brand?.trim() ||
      "غير محدد";
    const brandId = serial.product.phoneBrandId || `brand-${label}`;
    const cost = serial.unitCost || 0;
    const row = phoneBrandMap.get(brandId) ?? {
      id: brandId,
      label,
      quantity: 0,
      value: 0,
    };
    row.quantity += 1;
    row.value += cost;
    phoneBrandMap.set(brandId, row);
    phoneValue += cost;
    phoneQuantity += 1;
  }

  const accessoryCategoryMap = new Map<string, StockValueBreakdownRow>();
  let accessoryValue = 0;
  let accessoryQuantity = 0;

  for (const inv of inventories) {
    if (inv.product.type !== "accessory") continue;
    const quantity = inv.quantity;
    if (quantity <= 0) continue;
    const value = quantity * inv.purchasePrice;
    const categoryId = inv.product.itemCategoryId || "uncategorized";
    const label = inv.product.itemCategory?.nameAr?.trim() || "غير مصنف";
    const row = accessoryCategoryMap.get(categoryId) ?? {
      id: categoryId,
      label,
      quantity: 0,
      value: 0,
    };
    row.quantity += quantity;
    row.value += value;
    accessoryCategoryMap.set(categoryId, row);
    accessoryValue += value;
    accessoryQuantity += quantity;
  }

  // موبايلات بدون سيريالات available — لا تُضاف للقيمة (متسق مع شاشة المخzون)

  phoneValue = roundMoney(phoneValue);
  accessoryValue = roundMoney(accessoryValue);

  const phonesByBrand = Array.from(phoneBrandMap.values())
    .map((row) => ({
      ...row,
      value: roundMoney(row.value),
    }))
    .filter((row) => row.value > 0.0001 || row.quantity > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "ar"));

  const accessoriesByCategory = Array.from(accessoryCategoryMap.values())
    .map((row) => ({
      ...row,
      value: roundMoney(row.value),
    }))
    .filter((row) => row.value > 0.0001 || row.quantity > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "ar"));

  return {
    totalValue: roundMoney(phoneValue + accessoryValue),
    phoneValue,
    accessoryValue,
    phoneQuantity,
    accessoryQuantity,
    phonesByBrand,
    accessoriesByCategory,
  };
}
