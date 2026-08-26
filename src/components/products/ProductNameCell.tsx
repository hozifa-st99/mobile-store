import { cn } from "@/lib/utils";

interface ProductNameCellProps {
  name: string;
  brand: string;
  type?: string;
  storage?: string | null;
  color?: string | null;
  ram?: string | null;
  imageUrl?: string | null;
  itemCategoryName?: string | null;
  itemBrandName?: string | null;
  itemNameLabel?: string | null;
  className?: string;
}

export function buildProductSubtitle({
  brand,
  type,
  storage,
  color,
  ram,
  itemCategoryName,
  itemBrandName,
  itemNameLabel,
}: Pick<
  ProductNameCellProps,
  | "brand"
  | "type"
  | "storage"
  | "color"
  | "ram"
  | "itemCategoryName"
  | "itemBrandName"
  | "itemNameLabel"
>): string {
  if (type === "phone" || storage || color || ram) {
    return [color, brand, storage, ram].filter(Boolean).join(" • ");
  }

  const accessoryLine = [itemCategoryName, itemBrandName, itemNameLabel].filter(Boolean).join(" • ");
  return accessoryLine || brand;
}

export default function ProductNameCell({
  name,
  brand,
  type,
  storage,
  color,
  ram,
  imageUrl,
  itemCategoryName,
  itemBrandName,
  itemNameLabel,
  className,
}: ProductNameCellProps) {
  const subtitle = buildProductSubtitle({
    brand,
    type,
    storage,
    color,
    ram,
    itemCategoryName,
    itemBrandName,
    itemNameLabel,
  });

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="w-11 h-11 rounded-xl bg-background-input border border-border flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
        ) : (
          "📱"
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        {subtitle ? <p className="text-xs text-muted-dark truncate">{subtitle}</p> : null}
      </div>
    </div>
  );
}
