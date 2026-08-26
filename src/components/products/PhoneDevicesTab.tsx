"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PhoneDeviceDetailsContent from "@/components/products/PhoneDeviceDetailsContent";
import ProductNameCell from "@/components/products/ProductNameCell";
import { PhoneConditionBadge } from "@/components/products/PhoneConditionBadge";
import Modal from "@/components/ui/Modal";
import { FilterSelectWithLabel } from "@/components/ui/FilterControls";
import { ThEmoji, em } from "@/components/ui/TableEmoji";
import { apiJson } from "@/lib/api-client";
import type { PhoneDeviceRow } from "@/lib/phone-device-serial-details";
import { formatCurrency } from "@/lib/utils";

export type { PhoneDeviceRow };

interface PhoneDevicesTabProps {
  platformFilter?: string;
  phoneBrandFilter?: string;
}

export default function PhoneDevicesTab({
  platformFilter = "",
  phoneBrandFilter = "",
}: PhoneDevicesTabProps) {
  const [devices, setDevices] = useState<PhoneDeviceRow[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [selected, setSelected] = useState<PhoneDeviceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (brandFilter) params.set("brand", brandFilter);
    if (conditionFilter) params.set("deviceCondition", conditionFilter);

    const { ok, data } = await apiJson<{ devices: PhoneDeviceRow[]; brands: string[] }>(
      `/api/products/phone-devices${params.toString() ? `?${params}` : ""}`
    );

    if (ok) {
      setDevices(data.devices || []);
      setBrands(data.brands || []);
    }
    setLoading(false);
  }, [search, brandFilter, conditionFilter]);

  useEffect(() => {
    void load();
  }, [brandFilter, conditionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const hasFilters = !!search.trim() || !!brandFilter || !!conditionFilter;

  const visibleDevices = useMemo(() => {
    let list = devices;
    if (platformFilter) {
      list = list.filter((device) => device.product.phonePlatformId === platformFilter);
    }
    if (phoneBrandFilter) {
      list = list.filter((device) => device.product.phoneBrandId === phoneBrandFilter);
    }
    return list;
  }, [devices, platformFilter, phoneBrandFilter]);

  const visibleCount = visibleDevices.length;

  return (
    <>
      <div className="glass-card p-4 mb-5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark">🔍</span>
            <input
              type="text"
              placeholder="بحث بـ IMEI أو اسم الموبايل أو الشركة..."
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
            <FilterSelectWithLabel
              value={brandFilter}
              onChange={setBrandFilter}
              onClear={() => setBrandFilter("")}
            >
              <option value="">كل الشركات</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </FilterSelectWithLabel>

            <FilterSelectWithLabel
              value={conditionFilter}
              onChange={setConditionFilter}
              onClear={() => setConditionFilter("")}
            >
              <option value="">جديد / مستعمل</option>
              <option value="new">جديد</option>
              <option value="used">مستعمل</option>
            </FilterSelectWithLabel>

            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setBrandFilter("");
                  setConditionFilter("");
                }}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:text-white hover:border-primary/30 whitespace-nowrap"
              >
                مسح الفلاتر
              </button>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-muted mt-3">
          {loading ? "جاري التحميل..." : `${visibleCount} موبايل متاح في الفرع`}
        </p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="text-xs text-muted-dark border-b border-border bg-background-input/30">
                <ThEmoji emoji={em.product} className="text-right p-4 font-medium">
                  الموبايل
                </ThEmoji>
                <ThEmoji emoji={em.imei} className="text-right p-4 font-medium">
                  IMEI
                </ThEmoji>
                <ThEmoji emoji={em.purchasePrice} className="text-right p-4 font-medium">
                  سعر الشراء
                </ThEmoji>
                <ThEmoji emoji={em.salePrice} className="text-right p-4 font-medium">
                  سعر البيع
                </ThEmoji>
                <th className="text-right p-4 font-medium text-xs text-muted-dark">الدورة</th>
                <ThEmoji emoji={em.actions} className="text-right p-4 font-medium w-32">
                  إجراءات
                </ThEmoji>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td colSpan={6} className="p-4">
                      <div className="h-10 bg-background-input/50 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : visibleDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted">
                    {hasFilters || platformFilter || phoneBrandFilter
                      ? "لا توجد موبايلات مطابقة للبحث"
                      : "لا توجد موبايلات متاحة حالياً"}
                  </td>
                </tr>
              ) : (
                visibleDevices.map((device) => (
                  <tr
                    key={device.serialId}
                    className="border-b border-border/40 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="p-4">
                      <div className="space-y-2">
                        <ProductNameCell
                          name={device.product.name}
                          brand={device.product.brand}
                          type="phone"
                          storage={device.product.storage}
                          color={device.product.color}
                          ram={device.product.ram}
                          imageUrl={device.product.imageUrl}
                        />
                        <PhoneConditionBadge condition={device.deviceCondition} />
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-mono text-primary-light">{device.imeiLabel}</p>
                      {device.barcode ? (
                        <p className="text-[11px] text-muted-dark mt-1">باركود: {device.barcode}</p>
                      ) : null}
                    </td>
                    <td className="p-4 text-sm text-muted">
                      {formatCurrency(device.purchasePrice)} ج.م
                    </td>
                    <td className="p-4 text-sm font-semibold text-white">
                      {formatCurrency(device.retailPrice)} ج.م
                    </td>
                    <td className="p-4 text-sm tabular-nums text-muted">{device.cycleIndex}</td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setSelected(device)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary-light transition-all hover:bg-primary/20 hover:text-white hover:border-primary/50"
                      >
                        <span>{em.view}</span>
                        التفاصيل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="تفاصيل الموبايل"
        size="lg"
      >
        {selected ? (
          <PhoneDeviceDetailsContent
            device={selected}
            mode="inventory"
            onCloseSourceLink={() => setSelected(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}
