"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import ProductNameCell from "@/components/products/ProductNameCell";
import { em } from "@/components/ui/TableEmoji";
import type { PhoneDeviceRow } from "@/lib/phone-device-serial-details";
import { formatCurrency } from "@/lib/utils";

export type PhoneDeviceDetailsMode = "inventory" | "sale";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DetailRow({
  emoji,
  label,
  value,
  accent = "#6339f9",
}: {
  emoji: string;
  label: string;
  value: string | number | null | undefined;
  accent?: string;
}) {
  const display = value == null || value === "" ? "—" : value;
  const empty = display === "—";

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-background-input/30 px-3 py-3 transition-all hover:border-primary/20 hover:bg-background-input/45">
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-[1.03]"
        style={{
          backgroundColor: `${accent}18`,
          boxShadow: `inset 0 1px 0 ${accent}22, 0 8px 18px ${accent}10`,
        }}
      >
        <span className="text-lg leading-none" aria-hidden>
          {emoji}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-medium text-muted-dark">{label}</p>
        <p className={`break-words text-sm font-semibold ${empty ? "text-muted" : "text-white"}`}>
          {display}
        </p>
      </div>
    </div>
  );
}

type DetailSectionVariant = "violet" | "sky" | "emerald";

const sectionThemes: Record<
  DetailSectionVariant,
  {
    shell: string;
    titleClass: string;
    defaultAccent: string;
  }
> = {
  violet: {
    shell: "rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4 shadow-[inset_0_1px_0_rgba(139,92,246,0.12)]",
    titleClass: "text-violet-100",
    defaultAccent: "#7c3aed",
  },
  sky: {
    shell: "rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 shadow-[inset_0_1px_0_rgba(14,165,233,0.12)]",
    titleClass: "text-sky-100",
    defaultAccent: "#0ea5e9",
  },
  emerald: {
    shell: "rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]",
    titleClass: "text-emerald-100",
    defaultAccent: "#22c55e",
  },
};

function DetailSection({
  emoji,
  title,
  accent,
  variant = "violet",
  children,
}: {
  emoji: string;
  title: string;
  accent?: string;
  variant?: DetailSectionVariant;
  children: ReactNode;
}) {
  const theme = sectionThemes[variant];
  const iconAccent = accent ?? theme.defaultAccent;

  return (
    <div className={theme.shell}>
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${iconAccent}18`,
            boxShadow: `inset 0 1px 0 ${iconAccent}22`,
          }}
        >
          <span className="text-base leading-none" aria-hidden>
            {emoji}
          </span>
        </div>
        <h4 className={`text-sm font-bold ${theme.titleClass}`}>{title}</h4>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function PhoneDeviceDetailsContent({
  device,
  mode = "inventory",
  onCloseSourceLink,
}: {
  device: PhoneDeviceRow;
  mode?: PhoneDeviceDetailsMode;
  onCloseSourceLink?: () => void;
}) {
  const isSale = mode === "sale";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background-input/20 to-background-input/10 p-4">
        <ProductNameCell
          name={device.product.name}
          brand={device.product.brand}
          type="phone"
          storage={device.product.storage}
          color={device.product.color}
          ram={device.product.ram}
          imageUrl={device.product.imageUrl}
        />
        <div
          className={`mt-4 grid grid-cols-1 gap-2 ${isSale ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
        >
          <DetailRow emoji={em.imei} label="IMEI" value={device.imeiLabel} accent="#3b82f6" />
          {!isSale ? (
            <DetailRow
              emoji={em.purchasePrice}
              label="سعر الشراء"
              value={`${formatCurrency(device.purchasePrice)} ج.م`}
              accent="#22c55e"
            />
          ) : null}
          <DetailRow
            emoji={em.salePrice}
            label="سعر البيع"
            value={`${formatCurrency(device.retailPrice)} ج.م`}
            accent="#f59e0b"
          />
        </div>
      </div>

      <DetailSection emoji={em.device} title="مواصفات الجهاز" variant="violet">
        <DetailRow emoji={em.branch} label="الشركة" value={device.product.brand} accent="#6366f1" />
        <DetailRow
          emoji={em.model}
          label="الموديل"
          value={device.product.phoneModelName}
          accent="#8b5cf6"
        />
        <DetailRow emoji={em.color} label="اللون" value={device.details.color} accent="#ec4899" />
        <DetailRow emoji={em.storage} label="المساحة" value={device.details.storage} accent="#06b6d4" />
        <DetailRow emoji={em.ram} label="الرام" value={device.details.ram} accent="#14b8a6" />
        <DetailRow emoji={em.serial} label="الباركود" value={device.details.barcode} accent="#64748b" />
      </DetailSection>

      <DetailSection emoji={em.invoice} title="بيانات وقت الإدخال" variant="sky">
        <DetailRow
          emoji={em.status}
          label="الحالة"
          value={device.details.deviceConditionLabel}
          accent="#a855f7"
        />
        <DetailRow
          emoji={em.tax}
          label="الضريبة"
          value={device.details.taxStatusLabel}
          accent="#0ea5e9"
        />
        <DetailRow
          emoji={em.warranty}
          label="الضمان"
          value={`${device.details.warrantyMonths} شهر`}
          accent="#10b981"
        />
        <DetailRow
          emoji={em.box}
          label="حالة الكارتونة"
          value={device.details.boxConditionLabel}
          accent="#f97316"
        />
        <DetailRow
          emoji={em.battery}
          label="نسبة البطارية"
          value={
            device.details.batteryPercent != null ? `${device.details.batteryPercent}%` : null
          }
          accent="#84cc16"
        />
        {!isSale ? (
          <DetailRow
            emoji={em.purchasePrice}
            label="سعر الشراء"
            value={`${formatCurrency(device.details.unitPrice)} ج.م`}
            accent="#22c55e"
          />
        ) : null}
        <DetailRow
          emoji={em.salePrice}
          label="سعر البيع"
          value={`${formatCurrency(device.details.retailPrice)} ج.م`}
          accent="#f59e0b"
        />
        <DetailRow emoji={em.cycle} label="رقم الدورة" value={device.cycleIndex} accent="#6366f1" />
        <DetailRow emoji={em.description} label="ملاحظات" value={device.details.itemNotes} accent="#94a3b8" />
      </DetailSection>

      {!isSale && device.source ? (
        <DetailSection emoji={em.invoice} title="مصدر الإدخال" variant="emerald">
          <DetailRow
            emoji={em.type}
            label="نوع المستند"
            value={device.source.kindLabel}
            accent="#7c3aed"
          />
          <DetailRow
            emoji={em.number}
            label="رقم المستند"
            value={device.source.documentNumber}
            accent="#6366f1"
          />
          <DetailRow
            emoji={em.supplier}
            label="الطرف"
            value={device.source.counterparty ?? "—"}
            accent="#0ea5e9"
          />
          <DetailRow
            emoji={em.date}
            label="تاريخ الإدخال"
            value={formatDate(device.source.documentDate)}
            accent="#14b8a6"
          />

          <div className="sm:col-span-2">
            <Link
              href={device.source.documentUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/25 hover:text-white"
              onClick={onCloseSourceLink}
            >
              <span aria-hidden>{em.link}</span>
              فتح المستند
            </Link>
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}
