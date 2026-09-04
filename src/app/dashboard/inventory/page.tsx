"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ProductMovementModal from "@/components/inventory/ProductMovementModal";
import ProductPurchasePriceModal from "@/components/inventory/ProductPurchasePriceModal";
import InventoryStockValueModal from "@/components/inventory/InventoryStockValueModal";
import ProductCatalogViewFilter from "@/components/products/ProductCatalogViewFilter";
import ProductNameCell from "@/components/products/ProductNameCell";
import { ProductTypeWithCondition } from "@/components/products/PhoneConditionBadge";
import PageHeader from "@/components/layout/PageHeader";
import { ClearFilterButton, FilterSelectWithLabel } from "@/components/ui/FilterControls";
import { CellEmoji, ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import {
  applyCatalogViewFilter,
  defaultCatalogViewFilter,
  type CatalogViewFilterState,
} from "@/lib/product-catalog-view-filter";
import { formatPriceRangeLabel, type PriceRangeSummary } from "@/lib/phone-serial-pricing";
import { formatCurrency } from "@/lib/utils";
import { isFullAccessRole } from "@/lib/permissions";
import type { InventoryStockValueSnapshot } from "@/lib/inventory-stock-value-display";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth-store";

interface InvItem {
  id: string;
  productId: string;
  name: string;
  brand: string;
  type: string;
  quantity: number;
  minQuantity: number;
  retailPrice: number;
  retailPriceRange?: PriceRangeSummary | null;
  status: string;
  storage?: string | null;
  color?: string | null;
  ram?: string | null;
  imageUrl?: string | null;
  phoneBrandName?: string | null;
  phoneModelName?: string | null;
  itemCategoryName?: string | null;
  itemBrandName?: string | null;
  itemNameLabel?: string | null;
  deviceCondition?: string | null;
  phonePlatformId?: string | null;
  phoneBrandId?: string | null;
}

interface Serial {
  id: string;
  imei?: string;
  serialNumber?: string;
  status: string;
  cycleIndex?: number;
  product: {
    nameAr: string;
    brand: string;
    type?: string;
    phonePlatformId?: string | null;
    phoneBrandId?: string | null;
  };
}

interface FilterOption {
  id: string;
  name: string;
}

interface PhoneCatalogEntryFilter {
  key: string;
  kind: "brand" | "platform";
  id: string;
  platformId: string;
  brandId?: string;
  name: string;
  models: FilterOption[];
}

interface InventoryFilters {
  productBrands: string[];
  suppliers: FilterOption[];
  phoneCatalogEntries: PhoneCatalogEntryFilter[];
  itemCategories: Array<
    FilterOption & { brands: Array<FilterOption & { names: FilterOption[] }> }
  >;
}

const statusMap: Record<string, { label: string; class: string }> = {
  available: { label: "متوفر", class: "status-complete" },
  low: { label: "منخفض", class: "status-pending" },
  out: {
    label: "نفد",
    class: "px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20",
  },
  sold: {
    label: "مباع",
    class: "px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20",
  },
};

const typeLabels: Record<string, string> = {
  phone: "موبايل",
  accessory: "إكسسوار",
  spare_part: "قطعة غيار",
  smartwatch: "ساعة",
  tablet: "تابلت",
  laptop: "لابتوب",
};

const selectClass =
  "bg-background-input border border-border rounded-xl px-4 py-2.5 text-sm text-muted focus:outline-none focus:border-primary/50 min-w-[140px]";

type StockStatus = "available" | "low" | "out";

function renderRetailPrice(item: InvItem): string {
  if (item.type === "phone" && item.retailPriceRange) {
    return `${formatPriceRangeLabel(item.retailPriceRange)} ج.م`;
  }
  return `${formatCurrency(item.retailPrice)} ج.م`;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InvItem[]>([]);
  const [serials, setSerials] = useState<Serial[]>([]);
  const [filterOptions, setFilterOptions] = useState<InventoryFilters | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"stock" | "serials">("stock");
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [productBrandFilter, setProductBrandFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [phoneEntryKey, setPhoneEntryKey] = useState("");
  const [phoneModelFilter, setPhoneModelFilter] = useState("");
  const [itemCategoryFilter, setItemCategoryFilter] = useState("");
  const [itemBrandFilter, setItemBrandFilter] = useState("");
  const [itemNameFilter, setItemNameFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "">("");
  const [movementProductId, setMovementProductId] = useState<string | null>(null);
  const [movementProductName, setMovementProductName] = useState("");
  const [purchaseProductId, setPurchaseProductId] = useState<string | null>(null);
  const [purchaseProductName, setPurchaseProductName] = useState("");
  const [catalogViewFilter, setCatalogViewFilter] =
    useState<CatalogViewFilterState>(defaultCatalogViewFilter);
  const userRole = useAuthStore((s) => s.user?.role ?? "");
  const [stockValuePasswordOpen, setStockValuePasswordOpen] = useState(false);
  const [stockValueOpen, setStockValueOpen] = useState(false);
  const [stockValueLoading, setStockValueLoading] = useState(false);
  const [stockValueError, setStockValueError] = useState<string | null>(null);
  const [stockValueSnapshot, setStockValueSnapshot] =
    useState<InventoryStockValueSnapshot | null>(null);

  const selectedPhoneEntry = useMemo(() => {
    if (!filterOptions || !phoneEntryKey) return null;
    return filterOptions.phoneCatalogEntries.find((entry) => entry.key === phoneEntryKey) ?? null;
  }, [filterOptions, phoneEntryKey]);

  const phoneModels = useMemo(() => selectedPhoneEntry?.models ?? [], [selectedPhoneEntry]);

  const itemBrands = useMemo(() => {
    if (!filterOptions || !itemCategoryFilter) return [];
    return (
      filterOptions.itemCategories.find((category) => category.id === itemCategoryFilter)?.brands ??
      []
    );
  }, [filterOptions, itemCategoryFilter]);

  const itemNames = useMemo(() => {
    if (!itemBrands.length || !itemBrandFilter) return [];
    return itemBrands.find((brand) => brand.id === itemBrandFilter)?.names ?? [];
  }, [itemBrands, itemBrandFilter]);

  const catalogFilteredItems = useMemo(
    () => applyCatalogViewFilter(items, catalogViewFilter),
    [items, catalogViewFilter]
  );

  const visibleItems = useMemo(() => {
    if (!statusFilter) return catalogFilteredItems;
    return catalogFilteredItems.filter((item) => item.status === statusFilter);
  }, [catalogFilteredItems, statusFilter]);

  const visibleSerials = useMemo(() => {
    return applyCatalogViewFilter(
      serials.map((serial) => ({
        serial,
        type: serial.product.type || "",
        phonePlatformId: serial.product.phonePlatformId,
        phoneBrandId: serial.product.phoneBrandId,
      })),
      catalogViewFilter
    ).map((entry) => entry.serial);
  }, [serials, catalogViewFilter]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (productBrandFilter) params.set("brand", productBrandFilter);
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (selectedPhoneEntry?.kind === "brand" && selectedPhoneEntry.brandId) {
      params.set("phoneBrandId", selectedPhoneEntry.brandId);
    }
    if (selectedPhoneEntry?.kind === "platform") {
      params.set("phonePlatformId", selectedPhoneEntry.platformId);
    }
    if (phoneModelFilter) params.set("phoneModelId", phoneModelFilter);
    if (itemCategoryFilter) params.set("itemCategoryId", itemCategoryFilter);
    if (itemBrandFilter) params.set("itemBrandId", itemBrandFilter);
    if (itemNameFilter) params.set("itemNameId", itemNameFilter);
    if (conditionFilter) params.set("deviceCondition", conditionFilter);
    return params.toString();
  }, [
    search,
    typeFilter,
    productBrandFilter,
    supplierFilter,
    phoneEntryKey,
    phoneModelFilter,
    selectedPhoneEntry,
    itemCategoryFilter,
    itemBrandFilter,
    itemNameFilter,
    conditionFilter,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    const query = buildQuery();
    const { ok, data } = await apiJson<{ items: InvItem[]; serials: Serial[] }>(
      `/api/inventory${query ? `?${query}` : ""}`
    );
    if (ok) {
      setItems(data.items || []);
      setSerials(data.serials || []);
    }
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => {
    void apiJson<{ filters: InventoryFilters }>("/api/inventory/filters").then(({ ok, data }) => {
      if (ok && data?.filters) setFilterOptions(data.filters);
    });
  }, []);

  useEffect(() => {
    void load();
  }, [
    typeFilter,
    productBrandFilter,
    supplierFilter,
    phoneEntryKey,
    phoneModelFilter,
    itemCategoryFilter,
    itemBrandFilter,
    itemNameFilter,
    conditionFilter,
  ]);

  useEffect(() => {
    if (search) {
      const timer = setTimeout(() => {
        void load();
      }, 400);
      return () => clearTimeout(timer);
    }
    void load();
  }, [search]);

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    setConditionFilter("");
    setPhoneEntryKey("");
    setPhoneModelFilter("");
    setItemCategoryFilter("");
    setItemBrandFilter("");
    setItemNameFilter("");
  };

  const hasActiveFilters =
    !!search ||
    !!typeFilter ||
    !!statusFilter ||
    !!productBrandFilter ||
    !!supplierFilter ||
    !!phoneEntryKey ||
    !!phoneModelFilter ||
    !!itemCategoryFilter ||
    !!itemBrandFilter ||
    !!itemNameFilter ||
    !!conditionFilter;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setProductBrandFilter("");
    setSupplierFilter("");
    setPhoneEntryKey("");
    setPhoneModelFilter("");
    setItemCategoryFilter("");
    setItemBrandFilter("");
    setItemNameFilter("");
    setConditionFilter("");
  };

  const handleStockValueClick = () => {
    if (!isFullAccessRole(userRole)) {
      toast.error("هذه الميزة تتطلب حساب أدمن أو سوبر أدمن");
      return;
    }
    setStockValueError(null);
    setStockValuePasswordOpen(true);
  };

  const handleStockValuePasswordSubmit = async (password: string) => {
    setStockValueLoading(true);
    setStockValueError(null);
    const { ok, data, status } = await apiJson<{
      snapshot?: InventoryStockValueSnapshot;
      message?: string;
    }>("/api/inventory/stock-value", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setStockValueLoading(false);

    if (!ok) {
      if (status === 403) {
        toast.error(data.message || "هذه الميزة تتطلب حساب أدمن أو سوبر أدمن");
        setStockValuePasswordOpen(false);
        return;
      }
      setStockValueError(data.message || "تعذر التحقق من كلمة المرور");
      return;
    }

    setStockValueSnapshot(data.snapshot ?? null);
    setStockValuePasswordOpen(false);
    setStockValueOpen(true);
  };

  const closeStockValueModals = () => {
    setStockValueOpen(false);
    setStockValuePasswordOpen(false);
    setStockValueError(null);
    setStockValueSnapshot(null);
  };

  return (
    <>
      <PageHeader
        title="المخزون"
        subtitle="كميات المنتجات والأرقام التسلسلية"
        centerAction={
          <button
            type="button"
            onClick={handleStockValueClick}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors"
          >
            <span aria-hidden>💰</span>
            قيمة المخزون
          </button>
        }
      />

      <ProductCatalogViewFilter
        value={catalogViewFilter}
        onChange={setCatalogViewFilter}
        className="mb-5 relative z-20"
      />

      <div className="glass-card p-4 mb-5 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark inline-flex items-center justify-center text-lg leading-none"
              title="Search"
            >
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الباركود أو IMEI..."
              className={`w-full bg-background-input border border-border rounded-xl py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-primary/50 ${search ? "pl-10" : "pl-4"}`}
            />
            {search ? (
              <span className="absolute left-2 top-1/2 -translate-y-1/2">
                <ClearFilterButton onClick={() => setSearch("")} label="مسح البحث" />
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("stock")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === "stock"
                  ? "bg-primary text-white"
                  : "border border-border text-muted hover:text-white"
              }`}
            >
              الكميات
            </button>
            <button
              onClick={() => setTab("serials")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === "serials"
                  ? "bg-primary text-white"
                  : "border border-border text-muted hover:text-white"
              }`}
            >
              IMEI / Serial
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value)}
            className={selectClass}
          >
            <option value="">كل الأنواع</option>
            <option value="phone">موبايل</option>
            <option value="accessory">إكسسوار</option>
          </select>

          <FilterSelectWithLabel
            value={conditionFilter}
            onChange={setConditionFilter}
            onClear={() => setConditionFilter("")}
            selectClassName={selectClass}
          >
            <option value="">جديد / مستعمل</option>
            <option value="new">جديد</option>
            <option value="used">مستعمل</option>
          </FilterSelectWithLabel>

          <select
            value={productBrandFilter}
            onChange={(e) => setProductBrandFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">شركة الصنف</option>
            {(filterOptions?.productBrands || []).map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">المورد</option>
            {(filterOptions?.suppliers || []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StockStatus | "")}
              className={selectClass}
            >
              <option value="">كل الحالات</option>
              <option value="available">متوفر</option>
              <option value="low">منخفض</option>
              <option value="out">نفد</option>
            </select>
            {statusFilter ? (
              <ClearFilterButton onClick={() => setStatusFilter("")} label="مسح فلتر الحالة" />
            ) : null}
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white hover:border-primary/30 whitespace-nowrap"
            >
              مسح الفلاتر
            </button>
          ) : null}
        </div>

        {typeFilter === "phone" && (
          <div className="flex flex-wrap gap-2">
            <select
              value={phoneEntryKey}
              onChange={(e) => {
                setPhoneEntryKey(e.target.value);
                setPhoneModelFilter("");
              }}
              className={selectClass}
            >
              <option value="">الشركة</option>
              {(filterOptions?.phoneCatalogEntries || []).map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
            </select>
            <select
              value={phoneModelFilter}
              onChange={(e) => setPhoneModelFilter(e.target.value)}
              className={selectClass}
              disabled={!phoneEntryKey}
            >
              <option value="">الموديل</option>
              {phoneModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {typeFilter === "accessory" && (
          <div className="flex flex-wrap gap-2">
            <select
              value={itemCategoryFilter}
              onChange={(e) => {
                setItemCategoryFilter(e.target.value);
                setItemBrandFilter("");
                setItemNameFilter("");
              }}
              className={selectClass}
            >
              <option value="">الفئة</option>
              {(filterOptions?.itemCategories || []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={itemBrandFilter}
              onChange={(e) => {
                setItemBrandFilter(e.target.value);
                setItemNameFilter("");
              }}
              className={selectClass}
              disabled={!itemCategoryFilter}
            >
              <option value="">الشركة</option>
              {itemBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <select
              value={itemNameFilter}
              onChange={(e) => setItemNameFilter(e.target.value)}
              className={selectClass}
              disabled={!itemBrandFilter}
            >
              <option value="">الصنف</option>
              {itemNames.map((name) => (
                <option key={name.id} value={name.id}>
                  {name.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden inventory-table-shell flex flex-col">
        <div className="overflow-auto flex-1 min-h-0">
          {tab === "stock" ? (
            <table className="w-full min-w-[980px]">
              <thead className="sticky top-0 z-10 bg-background-input/95 backdrop-blur-sm">
                <tr className="text-xs text-muted-dark border-b border-border">
                  <ThEmoji emoji={em.product} className="text-right p-4 font-medium">
                    المنتج
                  </ThEmoji>
                  <ThEmoji emoji={em.type} className="text-right p-4 font-medium">
                    النوع
                  </ThEmoji>
                  <ThEmoji emoji={em.quantity} className="text-right p-4 font-medium">
                    الكمية
                  </ThEmoji>
                  <ThEmoji emoji={em.minQuantity} className="text-right p-4 font-medium">
                    الحد الأدنى
                  </ThEmoji>
                  <ThEmoji emoji={em.salePrice} className="text-right p-4 font-medium">
                    سعر البيع
                  </ThEmoji>
                  <ThEmoji emoji={em.status} className="text-right p-4 font-medium">
                    الحالة
                  </ThEmoji>
                  <th className="text-right p-4 font-medium text-xs text-muted-dark">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted">
                      {statusFilter ? "لا توجد أصناف مطابقة للحالة المحددة" : "لا توجد بيانات مخزون"}
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => (
                    <tr key={item.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <ProductNameCell
                          name={item.name}
                          brand={item.brand}
                          type={item.type}
                          storage={item.storage}
                          color={item.color}
                          ram={item.ram}
                          imageUrl={item.imageUrl}
                          itemCategoryName={item.itemCategoryName}
                          itemBrandName={item.itemBrandName}
                          itemNameLabel={item.itemNameLabel}
                        />
                      </td>
                      <td className="p-4">
                        <ProductTypeWithCondition
                          type={item.type}
                          typeLabel={typeLabels[item.type] || item.type}
                          deviceCondition={item.deviceCondition}
                        />
                      </td>
                      <td className="p-4 text-sm font-semibold text-white">{item.quantity}</td>
                      <td className="p-4 text-sm text-muted">{item.minQuantity}</td>
                      <td className="p-4 text-sm text-white">{renderRetailPrice(item)}</td>
                      <td className="p-4">
                        <span className={statusMap[item.status]?.class || "status-pending"}>
                          {statusMap[item.status]?.label || item.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2 min-w-[9.5rem]">
                          <button
                            type="button"
                            onClick={() => {
                              setMovementProductId(item.productId);
                              setMovementProductName(item.name);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-light transition-colors hover:bg-primary/20 hover:text-white"
                          >
                            <span>{em.view}</span>
                            عرض كامل للحركة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseProductId(item.productId);
                              setPurchaseProductName(item.name);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-3 py-2 text-xs font-semibold text-accent-orange transition-colors hover:bg-accent-orange/20 hover:text-white"
                          >
                            <span>{em.salePrice}</span>
                            سعر الشراء
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[700px]">
              <thead className="sticky top-0 z-10 bg-background-input/95 backdrop-blur-sm">
                <tr className="text-xs text-muted-dark border-b border-border">
                  <ThEmoji emoji={em.product} className="text-right p-4 font-medium">
                    المنتج
                  </ThEmoji>
                  <ThEmoji emoji={em.imei} className="text-right p-4 font-medium">
                    IMEI
                  </ThEmoji>
                  <ThEmoji emoji={em.serial} className="text-right p-4 font-medium">
                    Serial
                  </ThEmoji>
                  <th className="text-right p-4 font-medium">الدورة</th>
                  <ThEmoji emoji={em.status} className="text-right p-4 font-medium">
                    الحالة
                  </ThEmoji>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : visibleSerials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted">
                      لا توجد أرقام تسلسلية
                    </td>
                  </tr>
                ) : (
                  visibleSerials.map((s) => (
                    <tr key={s.id} className="border-b border-border/40 hover:bg-white/[0.02]">
                      <td className="p-4 text-sm text-white">{s.product.nameAr}</td>
                      <td className="p-4 text-sm font-mono text-primary-light">
                        <CellEmoji emoji={em.imei}>{s.imei}</CellEmoji>
                      </td>
                      <td className="p-4 text-sm font-mono text-muted">
                        <CellEmoji emoji={em.serial}>{s.serialNumber}</CellEmoji>
                      </td>
                      <td className="p-4 text-sm tabular-nums text-muted">
                        {s.cycleIndex ?? "—"}
                      </td>
                      <td className="p-4">
                        <span className={statusMap[s.status]?.class || "status-pending"}>
                          {statusMap[s.status]?.label === "مباع"
                            ? "مباع"
                            : s.status === "available"
                              ? "متاح"
                              : s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ProductMovementModal
        open={movementProductId !== null}
        productId={movementProductId}
        productName={movementProductName}
        onClose={() => {
          setMovementProductId(null);
          setMovementProductName("");
        }}
      />

      <ProductPurchasePriceModal
        open={purchaseProductId !== null}
        productId={purchaseProductId}
        productName={purchaseProductName}
        onClose={() => {
          setPurchaseProductId(null);
          setPurchaseProductName("");
        }}
      />

      <InventoryStockValueModal
        open={stockValueOpen}
        passwordOpen={stockValuePasswordOpen}
        loading={stockValueLoading}
        error={stockValueError}
        snapshot={stockValueSnapshot}
        onClose={closeStockValueModals}
        onSubmitPassword={(password) => void handleStockValuePasswordSubmit(password)}
        onClosePassword={() => {
          if (!stockValueLoading) {
            setStockValuePasswordOpen(false);
            setStockValueError(null);
          }
        }}
      />
    </>
  );
}
