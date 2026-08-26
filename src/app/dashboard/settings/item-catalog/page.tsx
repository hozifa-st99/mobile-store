"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Modal from "@/components/ui/Modal";
import LogoUpload, { LogoDisplay } from "@/components/ui/LogoUpload";
import CatalogOverviewModal, {
  type CatalogOverviewSection,
} from "@/components/settings/CatalogOverviewModal";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import { kpiThemes } from "@/components/ui/kpi-themes";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface ItemName {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  createdAt?: string;
}

interface ItemBrand {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  createdAt?: string;
  names: ItemName[];
}

interface ItemCategory {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  brands: ItemBrand[];
}

type ModalKind =
  | "category-add"
  | "category-edit"
  | "brand-add"
  | "brand-edit"
  | "name-add"
  | "name-edit"
  | null;

async function api(url: string, options?: RequestInit) {
  const res = await apiFetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ItemCatalogPage() {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [editBrand, setEditBrand] = useState<ItemBrand | null>(null);
  const [editName, setEditName] = useState<ItemName | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formLogo, setFormLogo] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await api("/api/settings/item-categories");
    if (!ok) {
      toast.error((data.message as string) || "تعذر تحميل الأصناف");
      setLoading(false);
      return;
    }
    const list = ((data.categories as ItemCategory[]) || []).map((c) => ({
      ...c,
      brands: (c.brands || []).map((b) => ({
        ...b,
        names: b.names || [],
      })),
    }));
    setCategories(list);
    setSelectedId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
    setSelectedBrandId(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const selectedBrand = selected?.brands.find((b) => b.id === selectedBrandId) ?? null;

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.trim().toLowerCase();
    return categories.filter((c) => c.nameAr.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const filteredBrands = useMemo(() => {
    if (!selected) return [];
    if (!brandSearch.trim()) return selected.brands;
    const q = brandSearch.trim().toLowerCase();
    return selected.brands.filter((b) => b.nameAr.toLowerCase().includes(q));
  }, [selected, brandSearch]);

  const filteredNames = useMemo(() => {
    if (!selectedBrand) return [];
    if (!nameSearch.trim()) return selectedBrand.names;
    const q = nameSearch.trim().toLowerCase();
    return selectedBrand.names.filter((n) => n.nameAr.toLowerCase().includes(q));
  }, [selectedBrand, nameSearch]);

  const totalBrands = categories.reduce((sum, c) => sum + c.brands.length, 0);
  const totalNames = categories.reduce(
    (sum, c) => sum + c.brands.reduce((bSum, b) => bSum + (b.names?.length || 0), 0),
    0
  );

  const overviewSections = useMemo((): CatalogOverviewSection[] => {
    return categories.map((category) => ({
      id: category.id,
      title: category.nameAr,
      logoUrl: category.logoUrl,
      subtitle: `${category.brands.length} علامة · ${category.brands.reduce((s, b) => s + (b.names?.length || 0), 0)} اسم`,
      groups: category.brands.map((brand) => ({
        id: brand.id,
        title: brand.nameAr,
        logoUrl: brand.logoUrl,
        subtitle: `${brand.names?.length || 0} اسم`,
        rows: (brand.names || []).map((name) => ({
          id: name.id,
          nameAr: name.nameAr,
          logoUrl: name.logoUrl,
          meta: formatDate(name.createdAt),
        })),
      })),
    }));
  }, [categories]);

  const resetForm = () => {
    setFormName("");
    setFormLogo(null);
    setEditBrand(null);
    setEditName(null);
    setEditCategoryId(null);
  };

  const closeModal = () => {
    setModal(null);
    resetForm();
  };

  const openCategoryAdd = () => {
    resetForm();
    setModal("category-add");
  };

  const openBrandAdd = () => {
    if (!selected) {
      toast.warning("اختر صنفاً أولاً");
      return;
    }
    resetForm();
    setModal("brand-add");
  };

  const openBrandEdit = (brand: ItemBrand) => {
    setEditBrand(brand);
    setFormName(brand.nameAr);
    setFormLogo(brand.logoUrl ?? null);
    setModal("brand-edit");
  };

  const openNameAdd = () => {
    if (!selectedBrand) {
      toast.warning("اختر علامة تجارية أولاً");
      return;
    }
    resetForm();
    setModal("name-add");
  };

  const openNameEdit = (name: ItemName) => {
    setEditName(name);
    setFormName(name.nameAr);
    setFormLogo(name.logoUrl ?? null);
    setModal("name-edit");
  };

  const saveName = async () => {
    if (!formName.trim()) {
      toast.warning("اسم الصنف مطلوب");
      return;
    }
    if (!selectedBrand && modal !== "name-edit") return;

    setSaving(true);
    const isEdit = modal === "name-edit";
    const { ok, data } = isEdit
      ? await api(`/api/settings/item-names/${editName!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nameAr: formName.trim(), logoUrl: formLogo }),
        })
      : await api("/api/settings/item-names", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: selectedBrand!.id,
            nameAr: formName.trim(),
            logoUrl: formLogo,
          }),
        });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "فشل الحفظ");
      return;
    }
    toast.success(isEdit ? "تم تعديل الاسم" : "تم إضافة الاسم");
    closeModal();
    load();
  };

  const deleteName = async (name: ItemName) => {
    if (!confirm(`حذف «${name.nameAr}»؟`)) return;
    const { ok, data } = await api(`/api/settings/item-names/${name.id}`, { method: "DELETE" });
    if (!ok) {
      toast.error((data.message as string) || "تعذر الحذف");
      return;
    }
    toast.success("تم حذف الاسم");
    load();
  };

  const saveCategory = async () => {
    if (!formName.trim()) {
      toast.warning("اسم الصنف مطلوب");
      return;
    }
    setSaving(true);
    const isEdit = modal === "category-edit";
    const categoryId = editCategoryId || selected?.id;
    if (isEdit && !categoryId) {
      setSaving(false);
      toast.error("تعذر تحديد الصنف");
      return;
    }
    const { ok, data } = isEdit
      ? await api(`/api/settings/item-categories/${categoryId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nameAr: formName.trim(), logoUrl: formLogo }),
        })
      : await api("/api/settings/item-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nameAr: formName.trim(), logoUrl: formLogo }),
        });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "فشل الحفظ");
      return;
    }
    toast.success(isEdit ? "تم تعديل الصنف" : "تم إضافة الصنف");
    closeModal();
    load();
  };

  const saveBrand = async () => {
    if (!formName.trim()) {
      toast.warning("اسم العلامة التجارية مطلوب");
      return;
    }
    if (!selected && modal !== "brand-edit") return;

    setSaving(true);
    const isEdit = modal === "brand-edit";
    const { ok, data } = isEdit
      ? await api(`/api/settings/item-brands/${editBrand!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nameAr: formName.trim(), logoUrl: formLogo }),
        })
      : await api("/api/settings/item-brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selected!.id,
            nameAr: formName.trim(),
            logoUrl: formLogo,
          }),
        });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "فشل الحفظ");
      return;
    }
    toast.success(isEdit ? "تم تعديل العلامة" : "تم إضافة العلامة");
    closeModal();
    load();
  };

  const deleteCategory = async (category: ItemCategory) => {
    if (!confirm(`حذف صنف «${category.nameAr}» وكل علاماته التجارية؟`)) return;
    const { ok, data } = await api(`/api/settings/item-categories/${category.id}`, {
      method: "DELETE",
    });
    if (!ok) {
      toast.error((data.message as string) || "تعذر الحذف");
      return;
    }
    toast.success("تم حذف الصنف");
    load();
  };

  const deleteBrand = async (brand: ItemBrand) => {
    if (!confirm(`حذف العلامة «${brand.nameAr}»؟`)) return;
    const { ok, data } = await api(`/api/settings/item-brands/${brand.id}`, { method: "DELETE" });
    if (!ok) {
      toast.error((data.message as string) || "تعذر الحذف");
      return;
    }
    toast.success("تم حذف العلامة");
    load();
  };

  const modalTitle =
    modal === "category-add"
      ? "إضافة صنف جديد"
      : modal === "category-edit"
        ? "تعديل الصنف"
        : modal === "brand-add"
          ? "إضافة علامة تجارية"
          : modal === "brand-edit"
            ? "تعديل العلامة التجارية"
            : modal === "name-add"
              ? "إضافة اسم منتج"
              : modal === "name-edit"
                ? "تعديل اسم المنتج"
                : "";

  const onModalSave =
    modal === "category-add" || modal === "category-edit"
      ? saveCategory
      : modal === "name-add" || modal === "name-edit"
        ? saveName
        : saveBrand;

  const isNameModal = modal === "name-add" || modal === "name-edit";
  const logoPlaceholderName = modal?.startsWith("category")
    ? "صنف"
    : isNameModal
      ? "منتج"
      : "علامة";

  return (
    <div className="catalog-page pb-10 animate-fade-in">
      <div className="mb-5">
        <nav className="flex items-center gap-2 text-xs text-muted-dark mb-3">
          <Link href="/dashboard/settings" className="hover:text-primary-light transition-colors">
            الإعدادات
          </Link>
          <span className="opacity-60">◀</span>
          <span className="text-muted">المخزون والمنتجات</span>
          <span className="opacity-60">◀</span>
          <span className="text-white">قائمة الأصناف</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">قائمة الأصناف</h1>
          <button
            type="button"
            onClick={() => setOverviewOpen(true)}
            disabled={loading || categories.length === 0}
            className="btn-outline text-sm px-4 py-2.5 disabled:opacity-40"
          >
            📋 عرض كل الأسماء
          </button>
        </div>
      </div>

      <div className="catalog-info-banner flex gap-3 p-4 mb-6">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(20,184,166,0.22)" }}
        >
          <span className="text-lg">ℹ️</span>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          أضف <strong className="text-white">أصناف</strong> مثل سماعات أو ساعات، ثم{" "}
          <strong className="text-white">العلامات التجارية</strong>، ثم{" "}
          <strong className="text-white">أسماء المنتجات</strong> تحت كل علامة. في فاتورة
          المشتريات يُختار الاسم من القائمة بدلاً من الكتابة اليدوية.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          className="catalog-stat-card"
          style={
            {
              "--stat-bg": kpiThemes.inventory.bg,
              "--stat-shadow": kpiThemes.inventory.shadow,
              "--stat-shine": kpiThemes.inventory.shine,
            } as React.CSSProperties
          }
        >
          <span className="catalog-stat-card__gloss" aria-hidden />
          <div className="relative z-[1]">
            <p className="catalog-stat-card__label">إجمالي الأصناف</p>
            <p className="catalog-stat-card__value">{categories.length}</p>
          </div>
        </div>
        <div
          className="catalog-stat-card"
          style={
            {
              "--stat-bg": kpiThemes.customers.bg,
              "--stat-shadow": kpiThemes.customers.shadow,
              "--stat-shine": kpiThemes.customers.shine,
            } as React.CSSProperties
          }
        >
          <span className="catalog-stat-card__gloss" aria-hidden />
          <div className="relative z-[1]">
            <p className="catalog-stat-card__label">إجمالي العلامات</p>
            <p className="catalog-stat-card__value">{totalBrands}</p>
          </div>
        </div>
        <div
          className="catalog-stat-card"
          style={
            {
              "--stat-bg": kpiThemes.sales.bg,
              "--stat-shadow": kpiThemes.sales.shadow,
              "--stat-shine": kpiThemes.sales.shine,
            } as React.CSSProperties
          }
        >
          <span className="catalog-stat-card__gloss" aria-hidden />
          <div className="relative z-[1]">
            <p className="catalog-stat-card__label">أسماء المنتجات</p>
            <p className="catalog-stat-card__value">{totalNames}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* الأصناف */}
        <div className="xl:col-span-3 catalog-panel catalog-models-panel flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="section-title">الأصناف</h2>
              <button
                type="button"
                onClick={openCategoryAdd}
                className="catalog-btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold hover:brightness-110 whitespace-nowrap"
              >
                ➕ إضافة صنف
              </button>
            </div>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark">🔍</span>
              <input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="بحث عن صنف..."
                className="w-full rounded-lg py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#6339f9]/50 catalog-control"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 overscroll-contain">
            {loading ? (
              <div className="p-8 text-center text-muted-dark text-sm animate-pulse">جاري التحميل...</div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-8 text-center text-muted-dark text-sm">لا توجد أصناف — أضف صنفاً للبدء</div>
            ) : (
              filteredCategories.map((category) => {
                const active = selectedId === category.id;
                return (
                  <div
                    key={category.id}
                    className={cn(
                      "group w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all cursor-pointer border",
                      active ? "catalog-brand-active" : "border-transparent hover:bg-white/[0.03]"
                    )}
                    onClick={() => {
                      setSelectedId(category.id);
                      setSelectedBrandId(null);
                    }}
                  >
                    <LogoDisplay url={category.logoUrl} name={category.nameAr} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{category.nameAr}</p>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        {category.brands.length} علامة ·{" "}
                        {category.brands.reduce((s, b) => s + (b.names?.length || 0), 0)} اسم
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1 transition-opacity",
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(category.id);
                          setEditCategoryId(category.id);
                          setFormName(category.nameAr);
                          setFormLogo(category.logoUrl ?? null);
                          setModal("category-edit");
                        }}
                        className="catalog-action-edit w-8 h-8 rounded-lg flex items-center justify-center"
                        title="تعديل"
                      >
                        {em.edit}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCategory(category);
                        }}
                        className="catalog-action-delete w-8 h-8 rounded-lg flex items-center justify-center"
                        title="حذف"
                      >
                        {em.delete}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* العلامات التجارية */}
        <div className="xl:col-span-4 catalog-panel catalog-models-panel flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="section-title">العلامات التجارية</h2>
                {selected && (
                  <p className="text-xs text-muted mt-1">صنف: {selected.nameAr}</p>
                )}
              </div>
              <button
                type="button"
                onClick={openBrandAdd}
                disabled={!selected}
                className="catalog-btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold hover:brightness-110 disabled:opacity-40 whitespace-nowrap"
              >
                ➕ إضافة علامة
              </button>
            </div>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark">🔍</span>
              <input
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="بحث عن علامة تجارية..."
                disabled={!selected}
                className="w-full rounded-lg py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-[#64748b] focus:outline-none disabled:opacity-50 catalog-control"
              />
            </div>
          </div>

          <div className="catalog-models-scroll flex-1 min-h-0">
            {!selected ? (
              <div className="p-12 text-center text-muted-dark text-sm">اختر صنفاً لعرض العلامات التجارية</div>
            ) : loading ? (
              <div className="p-12 text-center text-muted-dark text-sm animate-pulse">جاري التحميل...</div>
            ) : filteredBrands.length === 0 ? (
              <div className="p-12 text-center text-muted-dark text-sm">
                لا توجد علامات — أضف علامة تجارية لهذا الصنف
              </div>
            ) : (
              <table className="w-full catalog-models-table">
                <thead>
                  <tr className="catalog-table-head">
                    <ThEmoji emoji={em.image} className="text-right py-3 px-4 w-20">
                      الشعار
                    </ThEmoji>
                    <ThEmoji emoji={em.name} className="text-right py-3 px-4">
                      اسم العلامة
                    </ThEmoji>
                    <ThEmoji emoji={em.date} className="text-right py-3 px-4 w-36">
                      تاريخ الإضافة
                    </ThEmoji>
                    <ThEmoji emoji={em.actions} className="text-center py-3 px-4 w-28">
                      إجراءات
                    </ThEmoji>
                  </tr>
                </thead>
                <tbody>
                  {filteredBrands.map((brand) => {
                    const active = selectedBrandId === brand.id;
                    return (
                    <tr
                      key={brand.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        active ? "bg-primary/10" : "hover:bg-white/[0.03]"
                      )}
                      onClick={() => setSelectedBrandId(brand.id)}
                    >
                      <td className="py-3 px-4">
                        <LogoDisplay url={brand.logoUrl} name={brand.nameAr} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-white">{brand.nameAr}</p>
                        <p className="text-[11px] text-muted-dark mt-0.5">
                          {brand.names?.length || 0} اسم
                        </p>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted">{formatDate(brand.createdAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBrandEdit(brand);
                            }}
                            className="catalog-action-edit w-8 h-8 rounded-lg flex items-center justify-center"
                            title="تعديل"
                          >
                            {em.edit}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBrand(brand);
                            }}
                            className="catalog-action-delete w-8 h-8 rounded-lg flex items-center justify-center"
                            title="حذف"
                          >
                            {em.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* أسماء المنتجات */}
        <div className="xl:col-span-5 catalog-panel catalog-models-panel flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="section-title">أسماء المنتجات</h2>
                {selectedBrand && (
                  <p className="text-xs text-muted mt-1">
                    {selected?.nameAr} · {selectedBrand.nameAr}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={openNameAdd}
                disabled={!selectedBrand}
                className="catalog-btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold hover:brightness-110 disabled:opacity-40 whitespace-nowrap"
              >
                ➕ إضافة اسم
              </button>
            </div>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark">🔍</span>
              <input
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="بحث عن اسم..."
                disabled={!selectedBrand}
                className="w-full rounded-lg py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-[#64748b] focus:outline-none disabled:opacity-50 catalog-control"
              />
            </div>
          </div>

          <div className="catalog-models-scroll flex-1 min-h-0">
            {!selectedBrand ? (
              <div className="p-12 text-center text-muted-dark text-sm">
                اختر علامة تجارية لإدارة أسماء المنتجات
              </div>
            ) : loading ? (
              <div className="p-12 text-center text-muted-dark text-sm animate-pulse">جاري التحميل...</div>
            ) : filteredNames.length === 0 ? (
              <div className="p-12 text-center text-muted-dark text-sm">
                لا توجد أسماء — أضف أسماء المنتجات لهذه العلامة
              </div>
            ) : (
              <table className="w-full catalog-models-table">
                <thead>
                  <tr className="catalog-table-head">
                    <ThEmoji emoji={em.image} className="text-right py-3 px-4 w-20">
                      الصورة
                    </ThEmoji>
                    <ThEmoji emoji={em.product} className="text-right py-3 px-4">
                      اسم المنتج
                    </ThEmoji>
                    <ThEmoji emoji={em.date} className="text-right py-3 px-4 w-36">
                      تاريخ الإضافة
                    </ThEmoji>
                    <ThEmoji emoji={em.actions} className="text-center py-3 px-4 w-28">
                      إجراءات
                    </ThEmoji>
                  </tr>
                </thead>
                <tbody>
                  {filteredNames.map((name) => (
                    <tr key={name.id}>
                      <td className="py-3 px-4">
                        <LogoDisplay url={name.logoUrl} name={name.nameAr} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-white">{name.nameAr}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted">{formatDate(name.createdAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openNameEdit(name)}
                            className="catalog-action-edit w-8 h-8 rounded-lg flex items-center justify-center"
                            title="تعديل"
                          >
                            {em.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteName(name)}
                            className="catalog-action-delete w-8 h-8 rounded-lg flex items-center justify-center"
                            title="حذف"
                          >
                            {em.delete}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Modal open={modal !== null} onClose={closeModal} title={modalTitle}>
        <div className="space-y-4">
          <div className="flex justify-center">
            <LogoUpload
              name={formName || logoPlaceholderName}
              value={formLogo}
              onChange={setFormLogo}
              size="lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-2">
              {modal?.startsWith("category")
                ? "اسم الصنف"
                : isNameModal
                  ? "اسم المنتج"
                  : "اسم العلامة التجارية"}
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={
                modal?.startsWith("category")
                  ? "مثال: سماعات"
                  : isNameModal
                    ? "مثال: AirPods Pro"
                    : "مثال: Apple"
              }
              className="glass-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && formName.trim() && !saving) {
                  e.preventDefault();
                  void onModalSave();
                }
              }}
            />
          </div>
          {selected && modal === "brand-add" && (
            <p className="text-sm text-muted">
              الصنف: <strong className="text-white">{selected.nameAr}</strong>
            </p>
          )}
          {selectedBrand && modal === "name-add" && (
            <p className="text-sm text-muted">
              العلامة: <strong className="text-white">{selectedBrand.nameAr}</strong>
            </p>
          )}
          <button
            type="button"
            onClick={onModalSave}
            disabled={saving || !formName.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {saving
              ? "جاري الحفظ..."
              : modal?.startsWith("category")
                ? "حفظ الصنف"
                : isNameModal
                  ? "حفظ الاسم"
                  : "حفظ العلامة"}
          </button>
        </div>
      </Modal>

      <CatalogOverviewModal
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        title="عرض كل أسماء الأصناف"
        sections={overviewSections}
        searchPlaceholder="بحث في الأصناف أو العلامات أو الأسماء..."
        emptyMessage="لا توجد أصناف أو أسماء مضافة بعد"
      />
    </div>
  );
}
