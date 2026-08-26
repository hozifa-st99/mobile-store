"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import ProductNameCell from "@/components/products/ProductNameCell";
import { ProductTypeWithCondition } from "@/components/products/PhoneConditionBadge";
import PhoneDevicesTab from "@/components/products/PhoneDevicesTab";
import PhonePlatformBrandChips from "@/components/products/PhonePlatformBrandChips";
import ProductBarcodePrintModal from "@/components/products/ProductBarcodePrintModal";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import { FilterSelectWithLabel } from "@/components/ui/FilterControls";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import { formatCurrency } from "@/lib/utils";
import { formatPriceRangeLabel, type PriceRangeSummary } from "@/lib/phone-serial-pricing";
import { apiJson } from "@/lib/api-client";

interface Product {
  id: string;
  name: string;
  brand: string;
  model?: string;
  storage?: string;
  color?: string;
  quantity: number;
  purchasePrice: number;
  retailPrice: number;
  purchasePriceRange?: PriceRangeSummary | null;
  retailPriceRange?: PriceRangeSummary | null;
  status: "available" | "low" | "out";
  imageUrl?: string;
  type: string;
  deviceCondition?: string | null;
  phonePlatformId?: string | null;
  phoneBrandId?: string | null;
  barcode?: string | null;
}

const statusMap = {
  available: { label: "متوفر", class: "status-complete" },
  low: { label: "منخفض", class: "status-pending" },
  out: { label: "نفد", class: "px-3 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20" },
};

type ProductStatus = Product["status"];
type ProductsTab = "all" | "phones" | "accessory" | "imei";

function resolveProductsTab(value: string | null): ProductsTab {
  if (value === "imei") return "imei";
  if (value === "phones") return "phones";
  if (value === "accessory") return "accessory";
  return "all";
}

function typeFilterForTab(tab: Exclude<ProductsTab, "imei"> | ProductsTab): string {
  if (tab === "phones") return "phone";
  if (tab === "accessory") return "accessory";
  return "";
}

const typeLabels: Record<string, string> = {
  phone: "موبايل",
  accessory: "إكسسوار",
  spare_part: "قطعة غيار",
  smartwatch: "ساعة ذكية",
  tablet: "تابلت",
  laptop: "لابتوب",
};

function renderProductPrice(
  product: Product,
  kind: "purchase" | "retail"
): string {
  if (product.type === "phone") {
    const range = kind === "purchase" ? product.purchasePriceRange : product.retailPriceRange;
    if (range) return `${formatPriceRangeLabel(range)} ج.م`;
  }

  const value = kind === "purchase" ? product.purchasePrice : product.retailPrice;
  return `${formatCurrency(value)} ج.م`;
}

function ProductsPageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted animate-pulse">
      جاري التحميل...
    </div>
  );
}

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
  const [confirmProduct, setConfirmProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [platformFilter, setPlatformFilter] = useState("");
  const [phoneBrandFilter, setPhoneBrandFilter] = useState("");
  const [imeiPlatformFilter, setImeiPlatformFilter] = useState("");
  const [imeiPhoneBrandFilter, setImeiPhoneBrandFilter] = useState("");
  const initialTab = resolveProductsTab(searchParams.get("tab"));
  const [tab, setTab] = useState<ProductsTab>(initialTab);
  const [typeFilter, setTypeFilter] = useState(() =>
    initialTab === "imei" ? "" : typeFilterForTab(initialTab)
  );

  useEffect(() => {
    const nextTab = resolveProductsTab(searchParams.get("tab"));
    setTab(nextTab);
    setPlatformFilter("");
    setPhoneBrandFilter("");
    setImeiPlatformFilter("");
    setImeiPhoneBrandFilter("");
    if (nextTab !== "imei") setTypeFilter(typeFilterForTab(nextTab));
  }, [searchParams]);

  const handleTabChange = (next: ProductsTab) => {
    setTab(next);
    setPlatformFilter("");
    setPhoneBrandFilter("");
    setImeiPlatformFilter("");
    setImeiPhoneBrandFilter("");
    if (next !== "imei") {
      setTypeFilter(typeFilterForTab(next));
    }
    if (next !== "phones" && next !== "all") setConditionFilter("");
  };

  const fetchProducts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (brandFilter) params.set("brand", brandFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (conditionFilter) params.set("deviceCondition", conditionFilter);

    const { ok, data } = await apiJson<{ products: Product[] }>(`/api/products?${params}`);
    if (ok) setProducts(data.products || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [brandFilter, typeFilter, conditionFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const brands = Array.from(new Set(products.map((p) => p.brand)));

  const visibleProducts = useMemo(() => {
    let list = products;
    if (tab === "phones" && platformFilter) {
      list = list.filter((product) => product.phonePlatformId === platformFilter);
    }
    if (tab === "phones" && phoneBrandFilter) {
      list = list.filter((product) => product.phoneBrandId === phoneBrandFilter);
    }
    if (statusFilter) {
      list = list.filter((product) => product.status === statusFilter);
    }
    return list;
  }, [products, tab, platformFilter, phoneBrandFilter, statusFilter]);

  const clearFilters = () => {
    setSearch("");
    setBrandFilter("");
    setConditionFilter("");
    setStatusFilter("");
    setPlatformFilter("");
    setPhoneBrandFilter("");
    setTypeFilter(tab === "imei" ? "" : typeFilterForTab(tab));
  };

  const hasActiveFilters =
    !!search ||
    !!brandFilter ||
    !!conditionFilter ||
    !!statusFilter ||
    !!platformFilter ||
    !!phoneBrandFilter ||
    (tab === "all" && !!typeFilter);

  const openEditConfirm = (product: Product) => {
    setConfirmProduct(product);
  };

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle="إدارة منتجات الفرع"
        action={{ label: "منتج جديد", href: "/dashboard/products/new" }}
      />

      <div className="flex items-center justify-between gap-3 mb-5 w-full">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === "all"
                ? "bg-primary text-white"
                : "border border-border text-muted hover:text-white"
            }`}
          >
            المنتجات
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("phones")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === "phones"
                ? "bg-primary text-white"
                : "border border-border text-muted hover:text-white"
            }`}
          >
            الموبايلات
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("accessory")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === "accessory"
                ? "bg-primary text-white"
                : "border border-border text-muted hover:text-white"
            }`}
          >
            اكسسوار
          </button>
        </div>
        <button
          type="button"
          onClick={() => handleTabChange("imei")}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "imei"
              ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30"
              : "border border-cyan-500/45 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:text-white hover:border-cyan-400/60"
          }`}
        >
          IMEI
        </button>
      </div>

      {tab === "imei" ? (
        <>
          <PhonePlatformBrandChips
            platformId={imeiPlatformFilter}
            phoneBrandId={imeiPhoneBrandFilter}
            onPlatformChange={(platformId) => {
              setImeiPlatformFilter(platformId);
              setImeiPhoneBrandFilter("");
            }}
            onPhoneBrandChange={setImeiPhoneBrandFilter}
            className="mb-5"
          />
          <PhoneDevicesTab
            platformFilter={imeiPlatformFilter}
            phoneBrandFilter={imeiPhoneBrandFilter}
          />
        </>
      ) : (
        <>
      {tab === "phones" ? (
        <PhonePlatformBrandChips
          platformId={platformFilter}
          phoneBrandId={phoneBrandFilter}
          onPlatformChange={(platformId) => {
            setPlatformFilter(platformId);
            setPhoneBrandFilter("");
          }}
          onPhoneBrandChange={setPhoneBrandFilter}
          className="mb-5"
        />
      ) : null}

      <div className="glass-card p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark inline-flex items-center justify-center text-lg leading-none"
              title="Search"
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="بحث بالاسم، الباركود، الماركة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full bg-background-input border border-border rounded-xl py-2.5 pr-10 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-primary/50 ${search ? "pl-10" : "pl-4"}`}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="مسح البحث"
                aria-label="مسح البحث"
                className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-base text-muted hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
              >
                <span aria-hidden>❌</span>
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="bg-background-input border border-border rounded-xl px-4 py-2.5 text-sm text-muted focus:outline-none focus:border-primary/50 min-w-[130px]"
            >
              <option value="">كل الماركات</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {tab === "all" ? (
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setConditionFilter("");
                }}
                className="bg-background-input border border-border rounded-xl px-4 py-2.5 text-sm text-muted focus:outline-none focus:border-primary/50 min-w-[130px]"
              >
                <option value="">كل الأنواع</option>
                {Object.entries(typeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            ) : null}
            {tab === "all" || tab === "phones" ? (
              <FilterSelectWithLabel
                value={conditionFilter}
                onChange={setConditionFilter}
                onClear={() => setConditionFilter("")}
              >
                <option value="">جديد / مستعمل</option>
                <option value="new">جديد</option>
                <option value="used">مستعمل</option>
              </FilterSelectWithLabel>
            ) : null}
            <div className="flex items-center gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProductStatus | "")}
                className="bg-background-input border border-border rounded-xl px-4 py-2.5 text-sm text-muted focus:outline-none focus:border-primary/50 min-w-[130px]"
              >
                <option value="">كل الحالات</option>
                <option value="available">متوفر</option>
                <option value="low">منخفض</option>
                <option value="out">نفد</option>
              </select>
              {statusFilter ? (
                <button
                  type="button"
                  onClick={() => setStatusFilter("")}
                  title="مسح فلتر الحالة"
                  aria-label="مسح فلتر الحالة"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-base text-muted hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                >
                  <span aria-hidden>❌</span>
                </button>
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
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <th className="text-right p-4 font-medium w-12">
                  <input type="checkbox" className="rounded accent-primary" />
                </th>
                <ThEmoji emoji={em.product} className="text-right p-4 font-medium">
                  المنتج
                </ThEmoji>
                <ThEmoji emoji={em.type} className="text-right p-4 font-medium">
                  النوع
                </ThEmoji>
                <ThEmoji emoji={em.purchasePrice} className="text-right p-4 font-medium">
                  سعر الشراء
                </ThEmoji>
                <ThEmoji emoji={em.salePrice} className="text-right p-4 font-medium">
                  سعر البيع
                </ThEmoji>
                <ThEmoji emoji={em.quantity} className="text-right p-4 font-medium">
                  الكمية
                </ThEmoji>
                <ThEmoji emoji={em.status} className="text-right p-4 font-medium">
                  الحالة
                </ThEmoji>
                <ThEmoji emoji={em.actions} className="text-right p-4 font-medium w-40">
                  إجراءات
                </ThEmoji>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td colSpan={8} className="p-4">
                      <div className="h-10 bg-background-input/50 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : visibleProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted">
                    <span
                      className="w-12 h-12 mx-auto mb-3 opacity-30 inline-flex items-center justify-center text-lg leading-none"
                      title="Package"
                    >
                      📦
                    </span>
                    <p>
                      {phoneBrandFilter
                        ? "لا توجد موبايلات لهذه الشركة"
                        : platformFilter
                          ? "لا توجد موبايلات لهذا النوع"
                          : statusFilter
                            ? "لا توجد منتجات مطابقة للحالة المحددة"
                            : tab === "phones"
                              ? "لا توجد موبايلات"
                              : tab === "accessory"
                                ? "لا توجد إكسسوارات"
                                : "لا توجد منتجات"}
                    </p>
                    {!statusFilter && !platformFilter && !phoneBrandFilter && tab === "all" ? (
                      <Link
                        href="/dashboard/products/new"
                        className="text-primary-light text-sm mt-2 inline-block hover:underline"
                      >
                        + أضف أول منتج
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ) : (
                visibleProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-border/40 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="p-4">
                      <input type="checkbox" className="rounded accent-primary" />
                    </td>
                    <td className="p-4">
                      <ProductNameCell
                        name={product.name}
                        brand={product.brand}
                        type={product.type}
                        storage={product.storage}
                        color={product.color}
                        imageUrl={product.imageUrl}
                      />
                    </td>
                    <td className="p-4">
                      <ProductTypeWithCondition
                        type={product.type}
                        typeLabel={typeLabels[product.type] || product.type}
                        deviceCondition={product.deviceCondition}
                      />
                    </td>
                    <td className="p-4 text-sm text-muted">{renderProductPrice(product, "purchase")}</td>
                    <td className="p-4 text-sm font-semibold text-white">
                      {renderProductPrice(product, "retail")}
                    </td>
                    <td className="p-4 text-sm text-white font-medium">{product.quantity}</td>
                    <td className="p-4">
                      <span className={statusMap[product.status].class}>
                        {statusMap[product.status].label}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditConfirm(product)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary-light transition-all hover:bg-primary/20 hover:text-white hover:border-primary/50"
                        >
                          <span className="inline-flex items-center justify-center text-base leading-none">{em.edit}</span>
                          تعديل أسعار
                        </button>
                        <button
                          type="button"
                          onClick={() => setBarcodeProduct(product)}
                          title="طباعة باركود"
                          className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-white/5 text-base leading-none transition-colors hover:bg-white/10 hover:text-white"
                        >
                          {em.print}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={confirmProduct !== null}
        onClose={() => setConfirmProduct(null)}
        title="تأكيد تعديل سعر البيع"
        size="sm"
      >
        {confirmProduct ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-border/50 bg-background-input/20 p-4 space-y-2">
              <p className="text-sm font-bold text-white">{confirmProduct.name}</p>
              <p className="text-xs text-muted">
                {confirmProduct.brand} · {typeLabels[confirmProduct.type] || confirmProduct.type}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="rounded-lg bg-background-input/40 px-3 py-2">
                  <p className="text-muted mb-1">سعر الشراء</p>
                  <p className="font-bold text-white">{renderProductPrice(confirmProduct, "purchase")}</p>
                </div>
                <div className="rounded-lg bg-background-input/40 px-3 py-2">
                  <p className="text-muted mb-1">سعر البيع الحالي</p>
                  <p className="font-bold text-accent-green">{renderProductPrice(confirmProduct, "retail")}</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted leading-relaxed">
              سيتم فتح شاشة تعديل <span className="text-white font-semibold">سعر البيع فقط</span> مع
              تسجيل السبب وعرض تقرير التغييرات والفواتير المرتبطة.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmProduct(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white transition-colors"
              >
                إلغاء
              </button>
              <Link
                href={`/dashboard/products/${confirmProduct.id}`}
                className="btn-primary px-5 py-2.5 text-sm text-center"
              >
                متابعة التعديل
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>

      <ProductBarcodePrintModal
        open={barcodeProduct !== null}
        product={barcodeProduct}
        onClose={() => setBarcodeProduct(null)}
      />
        </>
      )}
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsPageFallback />}>
      <ProductsPageContent />
    </Suspense>
  );
}
