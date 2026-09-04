"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import DualSimImeiSuggestion from "@/components/purchases/DualSimImeiSuggestion";
import PhoneModelSpecSelect from "@/components/phones/PhoneModelSpecSelect";
import { apiJson } from "@/lib/api-client";
import type { ImeiCyclePreview } from "@/lib/imei-cycle-preview-types";
import { getClientSpecRequirements } from "@/lib/phone-model-requirements";
import { isValidImeiFormat } from "@/lib/product-serial-imeis";
import { toast } from "@/lib/toast";

interface PhoneModelOption {
  id: string;
  nameAr: string;
  colors?: unknown;
  storageOptions?: unknown;
  ramOptions?: unknown;
}

interface PhonePlatform {
  id: string;
  nameAr: string;
  requiresBrand: boolean;
  requireColors?: boolean;
  requireStorage?: boolean;
  requireRam?: boolean;
  brands: {
    id: string;
    nameAr: string;
    requireColors?: boolean;
    requireStorage?: boolean;
    requireRam?: boolean;
    models: PhoneModelOption[];
  }[];
  models: PhoneModelOption[];
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<PhonePlatform[]>([]);
  const [imeis, setImeis] = useState<string[]>([""]);
  const [cyclePreview, setCyclePreview] = useState<ImeiCyclePreview | null>(null);
  const [cycleLoading, setCycleLoading] = useState(false);

  const filledImeis = useMemo(
    () => imeis.map((imei) => imei.trim()).filter(Boolean),
    [imeis]
  );

  const [phoneSelection, setPhoneSelection] = useState({
    platformId: "",
    brandId: "",
    modelId: "",
  });

  const [form, setForm] = useState({
    type: "phone",
    barcode: "",
    sku: "",
    color: "",
    storage: "",
    ram: "",
    warrantyMonths: 12,
    quantity: 0,
    minQuantity: 5,
    purchasePrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
  });

  const set = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    fetch("/api/settings/phone-platforms")
      .then((r) => r.json())
      .then((d) => setPlatforms(d.platforms || []));
  }, []);

  const selectedPlatform = platforms.find((p) => p.id === phoneSelection.platformId);
  const availableModels = selectedPlatform?.requiresBrand
    ? selectedPlatform.brands.find((b) => b.id === phoneSelection.brandId)?.models || []
    : selectedPlatform?.models || [];

  const selectedModel = availableModels.find((m) => m.id === phoneSelection.modelId);
  const specRequirements = getClientSpecRequirements(platforms, phoneSelection);
  const showSpecFields =
    specRequirements.requireColors ||
    specRequirements.requireStorage ||
    specRequirements.requireRam;

  useEffect(() => {
    setForm((f) => ({ ...f, color: "", storage: "", ram: "" }));
  }, [phoneSelection.modelId]);

  useEffect(() => {
    if (filledImeis.length === 0 || filledImeis.some((imei) => !isValidImeiFormat(imei))) {
      setCyclePreview(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setCycleLoading(true);
      void apiJson<{ preview: ImeiCyclePreview }>(
        `/api/devices/imei-cycle-preview?imei=${encodeURIComponent(filledImeis.join(","))}`
      )
        .then(({ ok, data }) => {
          if (cancelled) return;
          setCyclePreview(ok && data?.preview ? data.preview : null);
          setCycleLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setCyclePreview(null);
          setCycleLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filledImeis.join(",")]);

  const cycleHintClass = cyclePreview?.blocked
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : cyclePreview?.isReEntry
      ? "border-accent-orange/30 bg-accent-orange/10 text-accent-orange"
      : "border-primary/30 bg-primary/10 text-primary-light";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneSelection.modelId) {
      toast.error("يجب اختيار الموبايل من القائمة — راجع الإعدادات إذا القائمة فارغة");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          type: "phone",
          phonePlatformId: phoneSelection.platformId,
          phoneBrandId: phoneSelection.brandId || null,
          phoneModelId: phoneSelection.modelId,
          nameAr: selectedModel?.nameAr,
          brand: selectedPlatform?.requiresBrand
            ? selectedPlatform.brands.find((b) => b.id === phoneSelection.brandId)?.nameAr
            : selectedPlatform?.nameAr,
          imeis: imeis.filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "حدث خطأ");
        return;
      }
      toast.success("تم إضافة المنتج");
      router.push("/dashboard/products");
    } catch {
      toast.error("تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <Link href="/dashboard/products" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white transition-colors">
          <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="ArrowRight">➡️</span> رجوع للمنتجات
        </Link>
      </div>

      <PageHeader title="إضافة موبايل" subtitle="اختر الاسم من القائمة المعرفة في الإعدادات" />

      {platforms.length === 0 && (
        <div className="glass-card p-4 mb-5 border-accent-orange/30 bg-accent-orange/5">
          <p className="text-sm text-accent-orange">
            ⚠️ قائمة الموبايلات فارغة —{" "}
            <Link href="/dashboard/settings/phone-catalog" className="underline font-semibold">
              اذهب للإعدادات وأضف iPhone / Android
            </Link>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">صورة المنتج</h3>
          <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-primary/40 transition-colors cursor-pointer min-h-[200px]">
            <span className="w-10 h-10 text-muted-dark mb-3 inline-flex items-center justify-center text-lg leading-none" title="Upload">📤</span>
            <p className="text-sm text-muted">اسحب الصورة أو اضغط للرفع</p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          {/* Phone catalog selection */}
          <div className="glass-card p-5 border-primary/20">
            <h3 className="text-sm font-semibold text-white mb-4">اختيار الموبايل من القائمة *</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5">النوع</label>
                <select
                  required
                  value={phoneSelection.platformId}
                  onChange={(e) =>
                    setPhoneSelection({ platformId: e.target.value, brandId: "", modelId: "" })
                  }
                  className="glass-input"
                >
                  <option value="">— اختر —</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>{p.nameAr}</option>
                  ))}
                </select>
              </div>

              {selectedPlatform?.requiresBrand && (
                <div>
                  <label className="block text-xs text-muted mb-1.5">الشركة</label>
                  <select
                    required
                    value={phoneSelection.brandId}
                    onChange={(e) =>
                      setPhoneSelection({ ...phoneSelection, brandId: e.target.value, modelId: "" })
                    }
                    className="glass-input"
                  >
                    <option value="">— اختر —</option>
                    {selectedPlatform.brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.nameAr}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-muted mb-1.5">الموديل</label>
                <select
                  required
                  value={phoneSelection.modelId}
                  onChange={(e) =>
                    setPhoneSelection({ ...phoneSelection, modelId: e.target.value })
                  }
                  className="glass-input"
                  disabled={!phoneSelection.platformId || (selectedPlatform?.requiresBrand && !phoneSelection.brandId)}
                >
                  <option value="">— اختر —</option>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.nameAr}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedModel && (
              <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm text-white">
                  ✅ المختار: <strong>{selectedModel.nameAr}</strong>
                </p>
              </div>
            )}
          </div>

          <div className="glass-card p-5">
            {showSpecFields && (
              <>
                <h3 className="text-sm font-semibold text-white mb-4">المواصفات</h3>
                {selectedModel ? (
                  <PhoneModelSpecSelect
                    model={selectedModel}
                    color={form.color}
                    storage={form.storage}
                    ram={form.ram}
                    requirements={specRequirements}
                    onChange={(next) => setForm((f) => ({ ...f, ...next }))}
                  />
                ) : (
                  <p className="text-sm text-muted mb-4">
                    اختر الموديل أولاً لعرض المواصفات الإلزامية.
                  </p>
                )}
              </>
            )}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4${showSpecFields ? " mt-4" : ""}`}>
              <div>
                <label className="block text-xs text-muted mb-1.5">الباركود</label>
                <input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} className="glass-input" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">الضمان (شهر)</label>
                <input type="number" value={form.warrantyMonths} onChange={(e) => set("warrantyMonths", Number(e.target.value))} className="glass-input" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">الأسعار</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1.5">سعر الشراء</label>
                <input type="number" value={form.purchasePrice} onChange={(e) => set("purchasePrice", Number(e.target.value))} className="glass-input" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">سعر البيع *</label>
                <input type="number" required value={form.retailPrice} onChange={(e) => set("retailPrice", Number(e.target.value))} className="glass-input" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5">سعر الجملة</label>
                <input type="number" value={form.wholesalePrice} onChange={(e) => set("wholesalePrice", Number(e.target.value))} className="glass-input" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">أرقام IMEI</h3>
              <button type="button" onClick={() => setImeis([...imeis, ""])} className="text-xs text-primary-light flex items-center gap-1">
                <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-lg leading-none" title="Plus">➕</span> إضافة IMEI
              </button>
            </div>
            <div className="space-y-2">
              {imeis.map((imei, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={imei}
                    maxLength={15}
                    inputMode="numeric"
                    onChange={(e) => {
                      const updated = [...imeis];
                      updated[i] = e.target.value.replace(/\D/g, "").slice(0, 15);
                      setImeis(updated);
                    }}
                    className="glass-input flex-1"
                    placeholder="352099001761481"
                  />
                  {imeis.length > 1 && (
                    <button type="button" onClick={() => setImeis(imeis.filter((_, j) => j !== i))} className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted hover:text-red-400">
                      <span className="w-4 h-4 inline-flex items-center justify-center text-lg leading-none" title="X">❌</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {cycleLoading ? (
              <p className="text-xs text-muted mt-3">جاري التحقق من دورة الجهاز...</p>
            ) : cyclePreview?.message ? (
              <p className={`text-xs mt-3 rounded-lg border px-3 py-2 ${cycleHintClass}`}>
                {cyclePreview.message}
              </p>
            ) : filledImeis.length > 0 && filledImeis.every((imei) => isValidImeiFormat(imei)) ? (
              <p className="text-xs text-muted mt-3">أول دخول للمخزون — الدورة 1</p>
            ) : null}
            <DualSimImeiSuggestion
              cyclePreview={cyclePreview}
              imeis={imeis}
              onApply={setImeis}
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 sm:flex-none sm:px-10">
              {loading ? "جاري الحفظ..." : "حفظ المنتج"}
            </button>
            <Link href="/dashboard/products" className="btn-outline flex-1 sm:flex-none sm:px-10 text-center">إلغاء</Link>
          </div>
        </div>
      </form>
    </>
  );
}
