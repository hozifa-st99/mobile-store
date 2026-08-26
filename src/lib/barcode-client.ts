import { apiJson } from "@/lib/api-client";

/** باركود منتج إكسسوار مسجّل مسبقاً لنفس اسم الكatalog */
export async function fetchAccessoryBarcodeByItemName(
  itemNameId: string,
  deviceCondition: "new" | "used" = "new"
): Promise<string | null> {
  const params = new URLSearchParams({ itemNameId, deviceCondition });
  const { ok, data } = await apiJson<{ product?: { barcode?: string | null } | null }>(
    `/api/products/by-item-name?${params}`
  );
  if (!ok) return null;
  const barcode = data.product?.barcode?.trim();
  return barcode || null;
}

/** طلب باركود فريد من السيرفر (مُتحقق من قاعدة البيانات) */
export async function fetchUniqueBarcode(nameHint?: string): Promise<string> {
  const { ok, data, status } = await apiJson<{ barcode?: string; message?: string }>(
    "/api/barcode/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameHint: nameHint?.trim() || undefined }),
    }
  );

  if (ok && data.barcode) return data.barcode;

  const message =
    data.message ||
    (status === 401 ? "انتهت الجلسة — أعد تسجيل الدخول" : "تعذر توليد باركود فريد");
  throw new Error(message);
}
