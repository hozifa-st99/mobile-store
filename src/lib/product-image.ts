/** أول رابط صورة غير فارغ */
export function firstImageUrl(...urls: (string | null | undefined)[]): string | null {
  for (const url of urls) {
    const trimmed = url?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

type CatalogLogoProduct = {
  imageUrl?: string | null;
  phoneModel?: { logoUrl?: string | null } | null;
  phoneBrand?: { logoUrl?: string | null } | null;
  phonePlatform?: { logoUrl?: string | null } | null;
  itemBrand?: { logoUrl?: string | null } | null;
  itemName?: { logoUrl?: string | null } | null;
  itemCategory?: { logoUrl?: string | null } | null;
};

/** صورة المنتج مع fallback من لوجو الكatalog */
export function resolveProductImageUrl(product: CatalogLogoProduct): string | null {
  return firstImageUrl(
    product.imageUrl,
    product.phoneModel?.logoUrl,
    product.phoneBrand?.logoUrl,
    product.phonePlatform?.logoUrl,
    product.itemName?.logoUrl,
    product.itemBrand?.logoUrl,
    product.itemCategory?.logoUrl
  );
}

/** لوجو الكatalog للموبايل (للنسخ إلى Product.imageUrl) */
export function phoneCatalogLogoUrl(model: {
  logoUrl?: string | null;
  brand?: { logoUrl?: string | null } | null;
  platform?: { logoUrl?: string | null } | null;
}): string | null {
  return firstImageUrl(model.logoUrl, model.brand?.logoUrl, model.platform?.logoUrl);
}

/** لوجو الكatalog للإكسسوار */
export function accessoryCatalogLogoUrl(
  itemName?: { logoUrl?: string | null } | null,
  brand?: { logoUrl?: string | null } | null,
  category?: { logoUrl?: string | null } | null
): string | null {
  return firstImageUrl(itemName?.logoUrl, brand?.logoUrl, category?.logoUrl);
}
