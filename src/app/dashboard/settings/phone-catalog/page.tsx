"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Modal from "@/components/ui/Modal";
import LogoUpload, { LogoDisplay } from "@/components/ui/LogoUpload";
import CatalogOverviewModal, {
  type CatalogOverviewSection,
} from "@/components/settings/CatalogOverviewModal";
import BrandSelect from "@/components/ui/BrandSelect";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import ModelSpecBadges from "@/components/phones/ModelSpecBadges";
import ModelSpecFields from "@/components/phones/ModelSpecFields";
import RequiredSpecToggles from "@/components/phones/RequiredSpecToggles";
import { type OptionTagsInputHandle } from "@/components/ui/OptionTagsInput";
import { kpiThemes } from "@/components/ui/kpi-themes";
import { parseOptionList } from "@/lib/phone-model-options";
import {
  type ModelSpecRequirements,
  validateModelSpecs,
} from "@/lib/phone-model-requirements";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface PhoneModel {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  createdAt?: string;
  colors?: unknown;
  storageOptions?: unknown;
  ramOptions?: unknown;
}

interface PhoneBrand {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  requireColors?: boolean;
  requireStorage?: boolean;
  requireRam?: boolean;
  models: PhoneModel[];
}

interface PhonePlatform {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  requiresBrand: boolean;
  requireColors?: boolean;
  requireStorage?: boolean;
  requireRam?: boolean;
  brands: PhoneBrand[];
  models: PhoneModel[];
}

interface CatalogEntry {
  key: string;
  kind: "brand" | "platform";
  id: string;
  platformId: string;
  brandId?: string;
  nameAr: string;
  logoUrl?: string | null;
  models: PhoneModel[];
  requireColors: boolean;
  requireStorage: boolean;
  requireRam: boolean;
}

const EMPTY_REQUIREMENTS: ModelSpecRequirements = {
  requireColors: false,
  requireStorage: false,
  requireRam: false,
};

const COLOR_SUGGESTIONS = ["أسود", "أبيض", "ذهبي", "فضي", "أزرق", "Natural Titanium"];
const STORAGE_SUGGESTIONS = ["64GB", "128GB", "256GB", "512GB", "1TB"];
const RAM_SUGGESTIONS = ["4GB", "6GB", "8GB", "12GB", "16GB"];

async function api(url: string, options?: RequestInit) {
  const res = await apiFetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function buildEntries(platforms: PhonePlatform[]): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const p of platforms) {
    if (p.requiresBrand) {
      for (const b of p.brands) {
        entries.push({
          key: `brand-${b.id}`,
          kind: "brand",
          id: b.id,
          platformId: p.id,
          brandId: b.id,
          nameAr: b.nameAr,
          logoUrl: b.logoUrl,
          models: b.models,
          requireColors: !!b.requireColors,
          requireStorage: !!b.requireStorage,
          requireRam: !!b.requireRam,
        });
      }
    } else {
      entries.push({
        key: `platform-${p.id}`,
        kind: "platform",
        id: p.id,
        platformId: p.id,
        nameAr: p.nameAr,
        logoUrl: p.logoUrl,
        models: p.models,
        requireColors: !!p.requireColors,
        requireStorage: !!p.requireStorage,
        requireRam: !!p.requireRam,
      });
    }
  }
  return entries;
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PhoneCatalogPage() {
  const [platforms, setPlatforms] = useState<PhonePlatform[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalBrand, setModalBrand] = useState(false);
  const [modalModel, setModalModel] = useState(false);
  const [modalEdit, setModalEdit] = useState<PhoneModel | null>(null);
  const [modalEditBrand, setModalEditBrand] = useState<CatalogEntry | null>(null);
  const [formName, setFormName] = useState("");
  const [formLogo, setFormLogo] = useState<string | null>(null);
  const [formColors, setFormColors] = useState<string[]>([]);
  const [formStorage, setFormStorage] = useState<string[]>([]);
  const [formRam, setFormRam] = useState<string[]>([]);
  const [formRequire, setFormRequire] = useState<ModelSpecRequirements>(EMPTY_REQUIREMENTS);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const colorsRef = useRef<OptionTagsInputHandle>(null);
  const storageRef = useRef<OptionTagsInputHandle>(null);
  const ramRef = useRef<OptionTagsInputHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await api("/api/settings/phone-platforms");
    if (!ok) {
      toast.error((data.message as string) || "تعذر تحميل البيانات");
      setLoading(false);
      return;
    }
    const list = (data.platforms as PhonePlatform[]) || [];
    setPlatforms(list);
    const entries = buildEntries(list);
    setSelectedKey((prev) => {
      if (prev && entries.some((e) => e.key === prev)) return prev;
      return entries[0]?.key ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo(() => buildEntries(platforms), [platforms]);
  const selected = entries.find((e) => e.key === selectedKey) ?? null;
  const androidPlatform = platforms.find((p) => p.requiresBrand);

  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return entries;
    const q = brandSearch.trim().toLowerCase();
    return entries.filter((e) => e.nameAr.toLowerCase().includes(q));
  }, [entries, brandSearch]);

  const filteredModels = useMemo(() => {
    if (!selected) return [];
    if (!modelSearch.trim()) return selected.models;
    const q = modelSearch.trim().toLowerCase();
    return selected.models.filter((m) => m.nameAr.toLowerCase().includes(q));
  }, [selected, modelSearch]);

  const totalModels = entries.reduce((s, e) => s + e.models.length, 0);

  const overviewSections = useMemo((): CatalogOverviewSection[] => {
    return platforms.map((platform) => {
      const platformReq: ModelSpecRequirements = {
        requireColors: !!platform.requireColors,
        requireStorage: !!platform.requireStorage,
        requireRam: !!platform.requireRam,
      };

      if (platform.requiresBrand) {
        return {
          id: platform.id,
          title: platform.nameAr,
          logoUrl: platform.logoUrl,
          subtitle: `${platform.brands.length} شركة · ${platform.brands.reduce((s, b) => s + b.models.length, 0)} نوع`,
          groups: platform.brands.map((brand) => ({
            id: brand.id,
            title: brand.nameAr,
            logoUrl: brand.logoUrl,
            subtitle: `${brand.models.length} نوع`,
            rows: brand.models.map((model) => ({
              id: model.id,
              nameAr: model.nameAr,
              logoUrl: model.logoUrl,
              meta: formatDate(model.createdAt),
              subtitle: (
                <ModelSpecBadges
                  colors={model.colors}
                  storageOptions={model.storageOptions}
                  ramOptions={model.ramOptions}
                  requirements={{
                    requireColors: !!brand.requireColors,
                    requireStorage: !!brand.requireStorage,
                    requireRam: !!brand.requireRam,
                  }}
                />
              ),
            })),
          })),
        };
      }

      return {
        id: platform.id,
        title: platform.nameAr,
        logoUrl: platform.logoUrl,
        subtitle: `${platform.models.length} نوع`,
        groups: [
          {
            id: platform.id,
            title: platform.nameAr,
            logoUrl: platform.logoUrl,
            rows: platform.models.map((model) => ({
              id: model.id,
              nameAr: model.nameAr,
              logoUrl: model.logoUrl,
              meta: formatDate(model.createdAt),
              subtitle: (
                <ModelSpecBadges
                  colors={model.colors}
                  storageOptions={model.storageOptions}
                  ramOptions={model.ramOptions}
                  requirements={platformReq}
                />
              ),
            })),
          },
        ],
      };
    });
  }, [platforms]);

  const resetForm = () => {
    setFormName("");
    setFormLogo(null);
    setFormColors([]);
    setFormStorage([]);
    setFormRam([]);
    setFormRequire(EMPTY_REQUIREMENTS);
  };

  const entryRequirements = (entry: CatalogEntry | null): ModelSpecRequirements =>
    entry
      ? {
          requireColors: entry.requireColors,
          requireStorage: entry.requireStorage,
          requireRam: entry.requireRam,
        }
      : EMPTY_REQUIREMENTS;

  const collectModelSpecs = () => {
    const colors = colorsRef.current?.flush() ?? formColors;
    const storageOptions = storageRef.current?.flush() ?? formStorage;
    const ramOptions = ramRef.current?.flush() ?? formRam;
    setFormColors(colors);
    setFormStorage(storageOptions);
    setFormRam(ramOptions);
    return { colors, storageOptions, ramOptions };
  };

  const openEditBrandEntry = (entry: CatalogEntry) => {
    setFormName(entry.nameAr);
    setFormLogo(entry.logoUrl ?? null);
    setFormRequire(entryRequirements(entry));
    setModalEditBrand(entry);
  };

  const openAddBrand = () => {
    resetForm();
    setModalBrand(true);
  };

  const openEditModel = (model: PhoneModel) => {
    setFormName(model.nameAr);
    setFormLogo(model.logoUrl ?? null);
    setFormColors(parseOptionList(model.colors));
    setFormStorage(parseOptionList(model.storageOptions));
    setFormRam(parseOptionList(model.ramOptions));
    setModalEdit(model);
  };

  const saveBrand = async () => {
    if (!formName.trim()) return;
    if (!androidPlatform) {
      toast.error("جاري تهيئة منصة Android — حدّث الصفحة ثم أعد المحاولة");
      await load();
      return;
    }
    setSaving(true);
    const { ok, data } = await api("/api/settings/phone-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId: androidPlatform.id,
        nameAr: formName.trim(),
        logoUrl: formLogo,
        ...formRequire,
      }),
    });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "فشل الحفظ");
      return;
    }
    toast.success("تم حفظ الشركة");
    setModalBrand(false);
    resetForm();
    load();
  };

  const saveModel = async () => {
    if (!formName.trim() || !selected) return;
    const specs = collectModelSpecs();
    const requirements = entryRequirements(selected);
    const validationError = validateModelSpecs(specs, requirements);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    const { ok, data } = await api("/api/settings/phone-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformId: selected.platformId,
        brandId: selected.brandId || null,
        nameAr: formName.trim(),
        logoUrl: formLogo,
        ...specs,
      }),
    });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "فشل الحفظ");
      return;
    }
    toast.success("تم حفظ الموديل");
    setModalModel(false);
    resetForm();
    load();
  };

  const saveEdit = async () => {
    if (!modalEdit || !formName.trim() || !selected) return;
    const specs = collectModelSpecs();
    const requirements = entryRequirements(selected);
    const validationError = validateModelSpecs(specs, requirements);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    const { ok, data } = await api(`/api/settings/phone-models/${modalEdit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr: formName.trim(),
        logoUrl: formLogo,
        ...specs,
      }),
    });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "فشل التعديل");
      return;
    }
    toast.success("تم تحديث الموديل");
    setModalEdit(null);
    resetForm();
    load();
  };

  const saveEditBrand = async () => {
    if (!modalEditBrand || !formName.trim()) return;
    setSaving(true);
    const url =
      modalEditBrand.kind === "brand"
        ? `/api/settings/phone-brands/${modalEditBrand.id}`
        : `/api/settings/phone-platforms/${modalEditBrand.id}`;
    const { ok, data } = await api(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr: formName.trim(),
        logoUrl: formLogo,
        ...formRequire,
      }),
    });
    setSaving(false);
    if (!ok) {
      toast.error((data.message as string) || "فشل التعديل");
      return;
    }
    toast.success("تم حفظ إعدادات الشركة");
    setModalEditBrand(null);
    resetForm();
    load();
  };

  const deleteModel = async (id: string) => {
    if (!confirm("حذف هذا الموديل؟")) return;
    await api(`/api/settings/phone-models/${id}`, { method: "DELETE" });
    load();
  };

  const deleteBrand = async (entry: CatalogEntry) => {
    if (!confirm(`حذف ${entry.nameAr} وكل موديلاتها؟`)) return;
    if (entry.kind === "brand") {
      await api(`/api/settings/phone-brands/${entry.id}`, { method: "DELETE" });
    } else {
      await api(`/api/settings/phone-platforms/${entry.id}`, { method: "DELETE" });
    }
    load();
  };

  return (
    <div className="catalog-page pb-10 animate-fade-in">
      {/* ── عنوان + breadcrumb ── */}
      <div className="mb-5">
        <nav className="flex items-center gap-2 text-xs text-muted-dark mb-3">
          <Link href="/dashboard/settings" className="hover:text-primary-light transition-colors">
            الإعدادات
          </Link>
          <span className="w-3 h-3 rotate-180 inline-flex items-center justify-center text-lg leading-none" title="ChevronLeft">◀️</span>
          <span className="text-muted">المخزون والمنتجات</span>
          <span className="w-3 h-3 rotate-180 inline-flex items-center justify-center text-lg leading-none" title="ChevronLeft">◀️</span>
          <span className="text-white">الماركات والأنواع</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">الماركات والأنواع</h1>
          <button
            type="button"
            onClick={() => setOverviewOpen(true)}
            disabled={loading || platforms.length === 0}
            className="btn-outline text-sm px-4 py-2.5 disabled:opacity-40"
          >
            📋 عرض كل الموبايلات
          </button>
        </div>
      </div>

      {/* ── بانر معلومات ── */}
      <div className="catalog-info-banner flex gap-3 p-4 mb-6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(99,57,249,0.25)" }}>
          <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="Info">ℹ️</span>
        </div>
        <p className="text-sm text-muted leading-relaxed">
          من هذه الشاشة يمكنك إدارة <strong className="text-white">الشركات (Brands)</strong> و{" "}
          <strong className="text-white">أنواع الموبايلات</strong> المستخدمة في المنتجات والمخزون
          والفواتير. أي تعديل هنا ينعكس على القوائم في كل الفروع.
        </p>
      </div>

      {/* ── عمودين ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* ═══ يسار: الشركات ═══ */}
        <div className="xl:col-span-4 catalog-panel catalog-models-panel flex flex-col overflow-hidden">
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="section-title">الشركات (Brands)</h2>
              <button
                type="button"
                onClick={openAddBrand}
                className="catalog-btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold hover:brightness-110 whitespace-nowrap"
              >
                <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-lg leading-none" title="Plus">➕</span>
                إضافة شركة
              </button>
            </div>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark inline-flex items-center justify-center text-lg leading-none" title="Search">🔍</span>
              <input
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="بحث عن شركة..."
                className="w-full rounded-lg py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#6339f9]/50"
                style={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.06)" }}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 overscroll-contain">
            {loading ? (
              <div className="p-8 text-center text-muted-dark text-sm animate-pulse">جاري التحميل...</div>
            ) : filteredBrands.length === 0 ? (
              <div className="p-8 text-center text-muted-dark text-sm">لا توجد شركات</div>
            ) : (
              filteredBrands.map((entry) => {
                const active = selectedKey === entry.key;
                return (
                  <div
                    key={entry.key}
                    className={cn(
                      "group w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all cursor-pointer border",
                      active ? "catalog-brand-active" : "border-transparent hover:bg-white/[0.03]"
                    )}
                    onClick={() => setSelectedKey(entry.key)}
                  >
                    <span className="inline-flex items-center justify-center text-lg leading-none" title="ChevronLeft">◀️</span>
                    <LogoDisplay url={entry.logoUrl} name={entry.nameAr} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{entry.nameAr}</p>
                      <p className="text-xs text-[#64748b] mt-0.5">{entry.models.length} نوع</p>
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
                          openEditBrandEntry(entry);
                        }}
                        className="catalog-action-edit w-8 h-8 rounded-lg flex items-center justify-center"
                        title="تعديل الشركة"
                      >
                        <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-lg leading-none" title="Pencil">{em.edit}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBrand(entry);
                        }}
                        className="catalog-action-more w-8 h-8 rounded-lg flex items-center justify-center hover:text-white"
                        title="المزيد"
                      >
                        <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="MoreVertical">⋮</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* تقرير سفلي — مطابق للصورة */}
          <div className="catalog-stat-row mt-auto">
            <div
              className="catalog-stat-card"
              style={
                {
                  "--stat-bg": kpiThemes.invoices.bg,
                  "--stat-shadow": kpiThemes.invoices.shadow,
                  "--stat-shine": kpiThemes.invoices.shine,
                  "--stat-title-color": kpiThemes.invoices.titleColor,
                  "--stat-detail-color": kpiThemes.invoices.detailColor,
                } as React.CSSProperties
              }
            >
              <span className="catalog-stat-card__gloss" aria-hidden />
              <div className="catalog-stat-card__icon">
                <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="Building2">🏢</span>
              </div>
              <div className="relative z-[1]">
                <p className="catalog-stat-card__value">{entries.length}</p>
                <p className="catalog-stat-card__label">ماركات تجارية</p>
              </div>
            </div>
            <div
              className="catalog-stat-card"
              style={
                {
                  "--stat-bg": kpiThemes.maintenance.bg,
                  "--stat-shadow": kpiThemes.maintenance.shadow,
                  "--stat-shine": kpiThemes.maintenance.shine,
                  "--stat-title-color": kpiThemes.maintenance.titleColor,
                  "--stat-detail-color": kpiThemes.maintenance.detailColor,
                } as React.CSSProperties
              }
            >
              <span className="catalog-stat-card__gloss" aria-hidden />
              <div className="catalog-stat-card__icon">
                <span className="w-5 h-5 inline-flex items-center justify-center text-lg leading-none" title="Smartphone">📱</span>
              </div>
              <div className="relative z-[1]">
                <p className="catalog-stat-card__value">{totalModels}</p>
                <p className="catalog-stat-card__label">نوع موبايل</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ يمين: جدول الموديلات ═══ */}
        <div className="xl:col-span-8 catalog-panel catalog-models-panel flex flex-col overflow-hidden">
          <div className="p-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="section-title">أنواع الموبايلات حسب الشركة</h2>
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  resetForm();
                  setModalModel(true);
                }}
                className="catalog-btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold hover:brightness-110 disabled:opacity-40 whitespace-nowrap"
              >
                <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-lg leading-none" title="Plus">➕</span>
                إضافة نوع موبايل
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <BrandSelect
                options={entries.map((e) => ({
                  key: e.key,
                  nameAr: e.nameAr,
                  logoUrl: e.logoUrl,
                }))}
                value={selectedKey}
                onChange={setSelectedKey}
              />
              <div className="relative flex-1 sm:max-w-xs">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dark pointer-events-none inline-flex items-center justify-center text-lg leading-none" title="Search">🔍</span>
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="بحث عن نوع موبايل..."
                  className="catalog-control w-full pr-10 pl-3 text-sm text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#6339f9]/50"
                />
              </div>
            </div>
          </div>

          <div className="catalog-models-scroll px-1">
            <table className="catalog-models-table w-full min-w-[640px]">
              <thead>
                <tr>
                  <ThEmoji emoji={em.number} className="text-right py-3 px-4 font-medium w-12 text-[11px] text-[#64748b]">
                    #
                  </ThEmoji>
                  <ThEmoji emoji={em.image} className="text-right py-3 px-3 font-medium w-24 text-[11px] text-[#64748b]">
                    الصورة
                  </ThEmoji>
                  <ThEmoji emoji={em.device} className="text-right py-3 px-3 font-medium text-[11px] text-[#64748b]">
                    نوع الموبايل
                  </ThEmoji>
                  <ThEmoji emoji={em.date} className="text-right py-3 px-3 font-medium text-[11px] text-[#64748b]">
                    تاريخ الإضافة
                  </ThEmoji>
                  <ThEmoji emoji={em.status} className="text-right py-3 px-3 font-medium text-[11px] text-[#64748b]">
                    الحالة
                  </ThEmoji>
                  <ThEmoji emoji={em.actions} className="text-center py-3 px-4 font-medium w-32 text-[11px] text-[#64748b]">
                    إجراءات
                  </ThEmoji>
                </tr>
              </thead>
              <tbody>
                {!selected ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-dark text-sm">
                      اختر شركة من القائمة
                    </td>
                  </tr>
                ) : filteredModels.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted-dark text-sm">
                      لا توجد أنواع — اضغط «إضافة نوع موبايل»
                    </td>
                  </tr>
                ) : (
                  filteredModels.map((m, i) => (
                    <tr key={m.id}>
                      <td className="py-3.5 px-4 text-sm text-[#64748b]">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <LogoDisplay url={m.logoUrl} name={m.nameAr} size="product" />
                      </td>
                      <td className="py-3 px-3 align-top">
                        <p className="text-sm font-medium text-white">{m.nameAr}</p>
                        <ModelSpecBadges
                          colors={m.colors}
                          storageOptions={m.storageOptions}
                          ramOptions={m.ramOptions}
                          requirements={entryRequirements(selected)}
                        />
                      </td>
                      <td className="py-3 px-3 text-sm text-[#94a3b8]">{formatDate(m.createdAt)}</td>
                      <td className="py-3 px-3">
                        <span className="catalog-status-active">نشط</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            className="catalog-action-more w-8 h-8 rounded-lg flex items-center justify-center hover:text-white"
                          >
                            <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="MoreVertical">⋮</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteModel(m.id)}
                            className="catalog-action-delete w-8 h-8 rounded-lg flex items-center justify-center hover:brightness-110"
                          >
                            <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="Trash2">🗑️</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModel(m)}
                            className="catalog-action-edit w-8 h-8 rounded-lg flex items-center justify-center hover:brightness-110"
                          >
                            <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="Pencil">{em.edit}</span>
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
      </div>

      {/* ── Modals ── */}
      <Modal open={modalBrand} onClose={() => setModalBrand(false)} title="إضافة شركة">
        <div className="space-y-4">
          <div className="flex justify-center">
            <LogoUpload name={formName || "شركة"} value={formLogo} onChange={setFormLogo} size="lg" />
          </div>
          <input
            autoFocus
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="glass-input"
            placeholder="Samsung, Xiaomi, Apple..."
          />
          <RequiredSpecToggles value={formRequire} onChange={setFormRequire} />
          <button onClick={saveBrand} disabled={saving || !formName.trim()} className="btn-primary">
            {saving ? "جاري الحفظ..." : "حفظ الشركة"}
          </button>
        </div>
      </Modal>

      <Modal open={modalModel} onClose={() => setModalModel(false)} title="إضافة نوع موبايل">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <p className="text-sm text-muted">
            الشركة: <strong className="text-white">{selected?.nameAr}</strong>
          </p>
          <div className="flex justify-center">
            <LogoUpload name={formName || "موديل"} value={formLogo} onChange={setFormLogo} size="lg" />
          </div>
          <input
            autoFocus
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="glass-input"
            placeholder="iPhone 16 Pro Max"
          />
          <ModelSpecFields
            requirements={entryRequirements(selected)}
            formColors={formColors}
            formStorage={formStorage}
            formRam={formRam}
            onColorsChange={setFormColors}
            onStorageChange={setFormStorage}
            onRamChange={setFormRam}
            colorsRef={colorsRef}
            storageRef={storageRef}
            ramRef={ramRef}
            colorSuggestions={COLOR_SUGGESTIONS}
            storageSuggestions={STORAGE_SUGGESTIONS}
            ramSuggestions={RAM_SUGGESTIONS}
          />
          <button onClick={saveModel} disabled={saving || !formName.trim()} className="btn-primary">
            {saving ? "جاري الحفظ..." : "حفظ الموديل"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!modalEditBrand}
        onClose={() => {
          setModalEditBrand(null);
          resetForm();
        }}
        title={modalEditBrand?.kind === "platform" ? "تعديل المنصة" : "تعديل الشركة"}
      >
        <div className="space-y-4">
          <p className="text-sm text-[#94a3b8]">عدّل الاسم والصورة وحدّد الحقول الإلزامية للموديلات</p>
          <div className="flex justify-center">
            <LogoUpload name={formName || "شركة"} value={formLogo} onChange={setFormLogo} size="lg" />
          </div>
          <input
            autoFocus
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="glass-input"
            placeholder="اسم الشركة"
          />
          <RequiredSpecToggles value={formRequire} onChange={setFormRequire} />
          <button onClick={saveEditBrand} disabled={saving || !formName.trim()} className="btn-primary">
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!modalEdit}
        onClose={() => {
          setModalEdit(null);
          resetForm();
        }}
        title="تعديل نوع الموبايل"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <p className="text-sm text-[#94a3b8]">عدّل اسم الموديل والمواصفات المتاحة للشراء</p>
          <div className="flex justify-center">
            <LogoUpload name={formName || "موديل"} value={formLogo} onChange={setFormLogo} size="lg" />
          </div>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="glass-input"
            placeholder="اسم الموديل"
          />
          <ModelSpecFields
            requirements={entryRequirements(selected)}
            formColors={formColors}
            formStorage={formStorage}
            formRam={formRam}
            onColorsChange={setFormColors}
            onStorageChange={setFormStorage}
            onRamChange={setFormRam}
            colorsRef={colorsRef}
            storageRef={storageRef}
            ramRef={ramRef}
            colorSuggestions={COLOR_SUGGESTIONS}
            storageSuggestions={STORAGE_SUGGESTIONS}
            ramSuggestions={RAM_SUGGESTIONS}
          />
          <button onClick={saveEdit} disabled={saving || !formName.trim()} className="btn-primary">
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </Modal>

      <CatalogOverviewModal
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        title="عرض كل أنواع الموبايلات"
        sections={overviewSections}
        searchPlaceholder="بحث في المنصة أو الشركة أو الموديل..."
        emptyMessage="لا توجد ماركات أو موديلات مضافة بعد"
      />
    </div>
  );
}
