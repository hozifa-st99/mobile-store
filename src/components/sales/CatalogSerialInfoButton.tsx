"use client";

import { useState } from "react";

import PhoneDeviceDetailsContent from "@/components/products/PhoneDeviceDetailsContent";
import Modal from "@/components/ui/Modal";
import { apiJson } from "@/lib/api-client";
import type { SalePhoneDeviceRow } from "@/lib/phone-device-serial-details";

interface CatalogSerialInfoButtonProps {
  serialId: string;
}

export default function CatalogSerialInfoButton({ serialId }: CatalogSerialInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState<SalePhoneDeviceRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openDetails = async () => {
    if (!serialId) return;

    setOpen(true);
    setLoading(true);
    setError(null);
    setDevice(null);

    const { ok, data } = await apiJson<{ device?: SalePhoneDeviceRow; message?: string }>(
      `/api/sales/catalog-availability/serial-details?serialId=${encodeURIComponent(serialId)}`
    );

    if (ok && data.device) {
      setDevice(data.device);
    } else {
      setError(data.message || "تعذر تحميل تفاصيل الموبايل");
    }
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void openDetails()}
        title="تفاصيل الموبايل"
        aria-label="تفاصيل الموبايل"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-bold italic text-primary-light transition-all hover:border-primary/55 hover:bg-primary/20 hover:text-white"
      >
        i
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="تفاصيل الموبايل" size="lg">
        {loading ? (
          <div className="space-y-3 py-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-background-input/40" />
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-red-400">{error}</p>
        ) : device ? (
          <PhoneDeviceDetailsContent device={device} mode="sale" />
        ) : null}
      </Modal>
    </>
  );
}
