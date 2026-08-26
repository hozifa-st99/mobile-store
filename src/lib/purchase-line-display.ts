import type { AccessoryPurchaseLine } from "@/components/purchases/AccessoryPurchaseLineItem";
import type {
  PhonePlatformOption,
  PhonePurchaseLine,
} from "@/components/purchases/PhonePurchaseLineItem";
import type { ItemCategoryOption } from "@/components/purchases/AccessoryPurchaseLineItem";
import type { PurchaseLineItem } from "@/components/purchases/purchase-line-types";
import { buildPhoneDescription } from "@/lib/phone-model-options";
import { accessoryCatalogLogoUrl, phoneCatalogLogoUrl } from "@/lib/product-image";

function findModel(platforms: PhonePlatformOption[], item: PhonePurchaseLine) {
  const platform = platforms.find((p) => p.id === item.platformId);
  if (!platform) return null;
  const models = platform.requiresBrand
    ? platform.brands.find((b) => b.id === item.brandId)?.models || []
    : platform.models;
  return models.find((m) => m.id === item.modelId) || null;
}

export interface InvoiceLineRow {
  id: string;
  type: "phone" | "accessory";
  typeLabel: string;
  name: string;
  imageUrl?: string | null;
  details: string;
  quantity: number;
  unitPrice: number;
  retailPrice: number;
  total: number;
  unitPriceAfter?: number;
  expenseShare?: number;
  totalAfter?: number;
  barcode: string;
  imeis: string[];
  condition: string;
}

export function buildInvoiceLineRow(
  line: PurchaseLineItem & { id: string },
  platforms: PhonePlatformOption[],
  categories: ItemCategoryOption[]
): InvoiceLineRow {
  if (line.lineType === "phone") {
    const item = line.data;
    const model = findModel(platforms, item);
    const platform = platforms.find((p) => p.id === item.platformId);
    const brand = platform?.brands.find((b) => b.id === item.brandId);
    const imeis = item.imeis.map((i) => i.trim()).filter(Boolean);
    const specs = [item.color, item.storage, item.ram].filter(Boolean).join(" · ");
    const condition =
      item.deviceCondition === "used"
        ? `مستعمل${item.batteryPercent !== "" ? ` · بطارية ${item.batteryPercent}%` : ""}`
        : "جديد";

    return {
      id: line.id,
      type: "phone",
      typeLabel: "موبايل",
      name: model?.nameAr || "—",
      imageUrl: model
        ? phoneCatalogLogoUrl({
            logoUrl: model.logoUrl,
            brand,
            platform: platform ?? undefined,
          })
        : null,
      details: [
        platform?.requiresBrand ? brand?.nameAr : platform?.nameAr,
        specs,
        imeis.length > 0 ? `IMEI: ${imeis.join(" / ")}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      quantity: 1,
      unitPrice: item.unitPrice,
      retailPrice: item.retailPrice,
      total: item.unitPrice,
      barcode: item.barcode || "—",
      imeis,
      condition,
    };
  }

  const item = line.data;
  const category = categories.find((c) => c.id === item.itemCategoryId);
  const brand = category?.brands.find((b) => b.id === item.itemBrandId);
  const catalogName = brand?.names.find((n) => n.id === item.itemNameId);

  return {
    id: line.id,
    type: "accessory",
    typeLabel: category?.nameAr || "إكسسوار",
    name: catalogName?.nameAr || item.productName || "—",
    imageUrl: accessoryCatalogLogoUrl(catalogName, brand, category),
    details: [brand?.nameAr, item.barcode ? `باركود: ${item.barcode}` : null]
      .filter(Boolean)
      .join(" · "),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    retailPrice: item.retailPrice,
    total: item.quantity * item.unitPrice,
    barcode: item.barcode || "—",
    imeis: [],
    condition: item.deviceCondition === "used" ? "مستعمل" : "جديد",
  };
}

export function lineSubtotal(line: PurchaseLineItem): number {
  if (line.lineType === "phone") return line.data.unitPrice;
  return line.data.quantity * line.data.unitPrice;
}

export function phoneDisplayName(
  item: PhonePurchaseLine,
  platforms: PhonePlatformOption[]
): string {
  const model = findModel(platforms, item);
  if (!model) return "موبايل";
  return buildPhoneDescription(model.nameAr, {
    color: item.color,
    storage: item.storage,
    ram: item.ram,
  });
}

export function accessoryDisplayName(
  item: AccessoryPurchaseLine,
  categories: ItemCategoryOption[]
): string {
  const category = categories.find((c) => c.id === item.itemCategoryId);
  const brand = category?.brands.find((b) => b.id === item.itemBrandId);
  const catalogName = brand?.names.find((n) => n.id === item.itemNameId);
  return (
    catalogName?.nameAr ||
    item.productName.trim() ||
    category?.nameAr ||
    "صنف"
  );
}
