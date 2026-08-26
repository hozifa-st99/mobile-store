import "server-only";

import { prisma } from "@/lib/prisma";
import {
  mapSerialToPhoneDeviceRow,
  phoneSerialDetailsInclude,
  type PhoneDeviceRow,
  type PhoneSerialWithDetails,
} from "@/lib/phone-device-serial-details";
import {
  deviceConditionLabel,
  sourceKindLabel,
  taxStatusLabel,
} from "@/lib/phone-device-display";
import {
  formatDeviceImeisLabel,
  getDeviceImeis,
  getStoredDeviceImeis,
  isValidImeiFormat,
  normalizeDeviceImeis,
} from "@/lib/product-serial-imeis";
import { parseStocktakeSerials } from "@/lib/stocktake-serial-snapshot";
import { formatAmountExact } from "@/lib/utils";

export type ImeiTimelineEventType =
  | "stock_entry"
  | "purchase"
  | "purchase_return"
  | "sale"
  | "sale_return"
  | "stocktake";

export interface ImeiTimelineField {
  emoji: string;
  label: string;
  value: string;
}

export interface ImeiTimelineEvent {
  id: string;
  type: ImeiTimelineEventType;
  typeLabel: string;
  direction: "in" | "out";
  documentNumber: string;
  date: string;
  createdAt: string;
  partyName: string | null;
  detailUrl: string;
  summary: string;
  fields: ImeiTimelineField[];
}

export interface ImeiCycleBlock {
  cycleIndex: number;
  serialId: string;
  status: string;
  statusLabel: string;
  deviceImeis: string[];
  enteredAt: string;
  entryFields: ImeiTimelineField[];
  events: ImeiTimelineEvent[];
}

export interface ImeiTimelineCurrentState {
  serialId: string;
  cycleIndex: number;
  status: string;
  statusLabel: string;
  deviceImeis: string[];
  device: PhoneDeviceRow | null;
  summaryFields: ImeiTimelineField[];
}

export interface ImeiTimelineResult {
  imei: string;
  cycles: ImeiCycleBlock[];
  current: ImeiTimelineCurrentState | null;
}

const TYPE_LABELS: Record<ImeiTimelineEventType, string> = {
  stock_entry: "إدخال رصيد / بضاعة",
  purchase: "فاتورة مشتريات",
  purchase_return: "مرتجع مشتريات",
  sale: "فاتورة مبيعات",
  sale_return: "مرتجع مبيعات",
  stocktake: "تسوية / جرد",
};

const STATUS_LABELS: Record<string, string> = {
  available: "متاح في المخزون",
  sold: "مباع",
  removed: "غير موجود (جرد أو مرتجع)",
};

function compareOldestFirst(
  dateA: Date | string,
  createdA: Date | string,
  dateB: Date | string,
  createdB: Date | string
): number {
  const docDiff = new Date(dateA).getTime() - new Date(dateB).getTime();
  if (docDiff !== 0) return docDiff;
  return new Date(createdA).getTime() - new Date(createdB).getTime();
}

function formatMoney(value: number): string {
  return `${formatAmountExact(value)} ج.م`;
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function buildEntryFields(serial: PhoneSerialWithDetails): ImeiTimelineField[] {
  const row = mapSerialToPhoneDeviceRow(serial);
  const line = serial.purchaseItem ?? serial.stockEntryItem;

  return [
    { emoji: "📱", label: "المنتج", value: row.product.name },
    { emoji: "🏷️", label: "الماركة", value: row.product.brand },
    {
      emoji: "🔢",
      label: "IMEI",
      value: row.imeiLabel,
    },
    { emoji: "🔄", label: "رقم الدورة", value: String(row.cycleIndex) },
    {
      emoji: "📥",
      label: "مصدر الإدخال",
      value: row.source ? `${row.source.kindLabel} — ${row.source.documentNumber}` : "—",
    },
    {
      emoji: "📅",
      label: "تاريخ الإدخال",
      value: row.source ? formatDateTime(row.source.documentDate) : formatDateTime(serial.createdAt),
    },
    {
      emoji: "🤝",
      label: "الطرف",
      value: row.source?.counterparty ?? "—",
    },
    { emoji: "💰", label: "سعر الشراء", value: formatMoney(row.purchasePrice) },
    { emoji: "🏪", label: "سعر البيع", value: formatMoney(row.retailPrice) },
    {
      emoji: "✨",
      label: "حالة الجهاز",
      value: deviceConditionLabel(row.details.deviceCondition),
    },
    {
      emoji: "📦",
      label: "حالة الكارتونة",
      value: row.details.boxConditionLabel ?? "—",
    },
    {
      emoji: "🔋",
      label: "البطارية",
      value:
        row.details.batteryPercent != null ? `${row.details.batteryPercent}%` : "—",
    },
    {
      emoji: "🧾",
      label: "الضريبة",
      value: row.details.taxStatusLabel,
    },
    {
      emoji: "🛡️",
      label: "الضمان",
      value:
        row.details.warrantyMonths > 0 ? `${row.details.warrantyMonths} شهر` : "—",
    },
    {
      emoji: "🏷️",
      label: "الباركود",
      value: row.barcode ?? "—",
    },
    {
      emoji: "🎨",
      label: "اللون / السعة / الرام",
      value: [row.product.color, row.product.storage, row.product.ram].filter(Boolean).join(" · ") || "—",
    },
    {
      emoji: "📝",
      label: "ملاحظات",
      value: line?.itemNotes?.trim() || "—",
    },
  ];
}

function buildCurrentSummaryFields(
  serial: PhoneSerialWithDetails,
  device: PhoneDeviceRow | null
): ImeiTimelineField[] {
  const row = device ?? mapSerialToPhoneDeviceRow(serial);

  return [
    { emoji: "📡", label: "الحالة الحالية", value: statusLabel(serial.status) },
    { emoji: "📱", label: "المنتج", value: row.product.name },
    { emoji: "🔢", label: "IMEI", value: row.imeiLabel },
    { emoji: "🔄", label: "الدورة الحالية", value: String(serial.cycleIndex) },
    { emoji: "💰", label: "سعر الشراء", value: formatMoney(row.purchasePrice) },
    { emoji: "🏪", label: "سعر البيع", value: formatMoney(row.retailPrice) },
    {
      emoji: "✨",
      label: "حالة الجهاز",
      value: deviceConditionLabel(row.details.deviceCondition),
    },
    {
      emoji: "📥",
      label: "آخر مصدر إدخال",
      value: row.source ? `${row.source.kindLabel} — ${row.source.documentNumber}` : "—",
    },
  ];
}

async function loadStocktakeEventsBySerial(
  branchId: string,
  serials: PhoneSerialWithDetails[]
): Promise<Map<string, ImeiTimelineEvent[]>> {
  const map = new Map<string, ImeiTimelineEvent[]>();
  if (serials.length === 0) return map;

  const productIds = [...new Set(serials.map((serial) => serial.productId))];
  const items = await prisma.stocktakeItem.findMany({
    where: {
      productId: { in: productIds },
      stocktake: { branchId, status: "completed" },
      serialsSnapshot: { not: null },
    },
    select: {
      id: true,
      serialsSnapshot: true,
      stocktake: {
        select: {
          id: true,
          documentNumber: true,
          stocktakeDate: true,
          createdAt: true,
          mode: true,
          user: { select: { fullNameAr: true, username: true } },
        },
      },
    },
  });

  for (const serial of serials) {
    const events: ImeiTimelineEvent[] = [];

    for (const item of items) {
      const snapshots = parseStocktakeSerials(item.serialsSnapshot);
      const match = snapshots.find((snap) => snap.id === serial.id && !snap.present);
      if (!match) continue;

      const modeLabel = item.stocktake.mode === "full" ? "جرد كلي" : "جرد جزئي";
      const userName = item.stocktake.user?.fullNameAr || item.stocktake.user?.username;

      events.push({
        id: `stocktake-${item.id}-${serial.id}`,
        type: "stocktake",
        typeLabel: TYPE_LABELS.stocktake,
        direction: "out",
        documentNumber: item.stocktake.documentNumber,
        date: item.stocktake.stocktakeDate.toISOString(),
        createdAt: item.stocktake.createdAt.toISOString(),
        partyName: userName ? `${modeLabel} — ${userName}` : modeLabel,
        detailUrl: `/dashboard/inventory/stocktake/${item.stocktake.id}`,
        summary: "الجهاز اتعلّم ناقص في الجرد واتشال من المخزون",
        fields: [
          { emoji: "📋", label: "نوع الجرد", value: modeLabel },
          { emoji: "📄", label: "رقم المستند", value: item.stocktake.documentNumber },
          { emoji: "📅", label: "تاريخ الجرد", value: formatDateTime(item.stocktake.stocktakeDate) },
          { emoji: "👤", label: "المستخدم", value: userName ?? "—" },
          {
            emoji: "🔢",
            label: "IMEI",
            value: formatDeviceImeisLabel(match.imeis.length > 0 ? match.imeis : getDeviceImeis(serial)),
          },
        ],
      });
    }

    if (events.length > 0) {
      map.set(serial.id, events);
    }
  }

  return map;
}

async function buildEventsForSerial(
  serial: PhoneSerialWithDetails,
  stocktakeEvents: ImeiTimelineEvent[]
): Promise<ImeiTimelineEvent[]> {
  const events: ImeiTimelineEvent[] = [];
  const deviceImeis = getDeviceImeis(serial);
  const row = mapSerialToPhoneDeviceRow(serial);

  if (serial.purchaseItem) {
    const purchase = serial.purchaseItem.purchase;
    events.push({
      id: `purchase-${serial.purchaseItem.id}`,
      type: "purchase",
      typeLabel: TYPE_LABELS.purchase,
      direction: "in",
      documentNumber: purchase.invoiceNumber,
      date: purchase.purchaseDate.toISOString(),
      createdAt: purchase.purchaseDate.toISOString(),
      partyName: purchase.supplier.nameAr,
      detailUrl: `/dashboard/purchases/${purchase.id}`,
      summary: "دخول الجهاز للمخزون عبر فاتورة مشتريات",
      fields: [
        { emoji: "📄", label: "رقم الفاتورة", value: purchase.invoiceNumber },
        { emoji: "📅", label: "تاريخ الدخول", value: formatDateTime(purchase.purchaseDate) },
        { emoji: "🤝", label: "المورد", value: purchase.supplier.nameAr },
        { emoji: "💰", label: "سعر الشراء", value: formatMoney(row.purchasePrice) },
        { emoji: "🏪", label: "سعر البيع", value: formatMoney(row.retailPrice) },
        { emoji: "✨", label: "حالة الجهاز", value: deviceConditionLabel(row.details.deviceCondition) },
        { emoji: "🧾", label: "الضريبة", value: taxStatusLabel(serial.purchaseItem.taxStatus) },
        { emoji: "🔢", label: "IMEI", value: row.imeiLabel },
      ],
    });
  } else if (serial.stockEntryItem) {
    const entry = serial.stockEntryItem.stockEntry;
    events.push({
      id: `stock-entry-${serial.stockEntryItem.id}`,
      type: "stock_entry",
      typeLabel: TYPE_LABELS.stock_entry,
      direction: "in",
      documentNumber: entry.documentNumber,
      date: entry.entryDate.toISOString(),
      createdAt: entry.entryDate.toISOString(),
      partyName: null,
      detailUrl: `/dashboard/stock-entries/${entry.id}`,
      summary: "دخول الجهاز للمخزون عبر إدخال رصيد / بضاعة موجودة",
      fields: [
        { emoji: "📄", label: "رقم المستند", value: entry.documentNumber },
        { emoji: "📅", label: "تاريخ الدخول", value: formatDateTime(entry.entryDate) },
        { emoji: "📥", label: "المصدر", value: sourceKindLabel("stock_entry") },
        { emoji: "💰", label: "سعر الشراء", value: formatMoney(row.purchasePrice) },
        { emoji: "🏪", label: "سعر البيع", value: formatMoney(row.retailPrice) },
        { emoji: "✨", label: "حالة الجهاز", value: deviceConditionLabel(row.details.deviceCondition) },
        { emoji: "🔢", label: "IMEI", value: row.imeiLabel },
      ],
    });
  }

  const saleItems = await prisma.saleItem.findMany({
    where: { serialId: serial.id, sale: { branchId: serial.branchId, status: "completed" } },
    select: {
      id: true,
      unitPrice: true,
      total: true,
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          createdAt: true,
          customer: { select: { nameAr: true } },
        },
      },
    },
    orderBy: { sale: { saleDate: "asc" } },
  });

  for (const item of saleItems) {
    events.push({
      id: `sale-${item.id}`,
      type: "sale",
      typeLabel: TYPE_LABELS.sale,
      direction: "out",
      documentNumber: item.sale.invoiceNumber,
      date: item.sale.saleDate.toISOString(),
      createdAt: item.sale.createdAt.toISOString(),
      partyName: item.sale.customer?.nameAr || "عميل نقدي",
      detailUrl: `/dashboard/sales/${item.sale.id}`,
      summary: "بيع الجهاز للعميل",
      fields: [
        { emoji: "📄", label: "رقم الفاتورة", value: item.sale.invoiceNumber },
        { emoji: "📅", label: "تاريخ البيع", value: formatDateTime(item.sale.saleDate) },
        { emoji: "👤", label: "العميل", value: item.sale.customer?.nameAr || "عميل نقدي" },
        { emoji: "💵", label: "سعر البيع", value: formatMoney(item.unitPrice) },
        { emoji: "🔢", label: "IMEI", value: row.imeiLabel },
      ],
    });
  }

  const saleReturnItems = await prisma.saleReturnItem.findMany({
    where: {
      saleItem: { serialId: serial.id },
      saleReturn: { branchId: serial.branchId },
    },
    select: {
      id: true,
      unitPrice: true,
      total: true,
      saleReturn: {
        select: {
          id: true,
          returnNumber: true,
          returnDate: true,
          createdAt: true,
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              customer: { select: { nameAr: true } },
            },
          },
        },
      },
    },
    orderBy: { saleReturn: { returnDate: "asc" } },
  });

  for (const item of saleReturnItems) {
    events.push({
      id: `sale-return-${item.id}`,
      type: "sale_return",
      typeLabel: TYPE_LABELS.sale_return,
      direction: "in",
      documentNumber: item.saleReturn.returnNumber,
      date: item.saleReturn.returnDate.toISOString(),
      createdAt: item.saleReturn.createdAt.toISOString(),
      partyName: item.saleReturn.sale.customer?.nameAr || "عميل نقدي",
      detailUrl: `/dashboard/sales/${item.saleReturn.sale.id}`,
      summary: "مرتجع مبيعات — الجهاز رجع للمخزون",
      fields: [
        { emoji: "📄", label: "رقم المرتجع", value: item.saleReturn.returnNumber },
        { emoji: "📅", label: "تاريخ المرتجع", value: formatDateTime(item.saleReturn.returnDate) },
        {
          emoji: "🧾",
          label: "فاتورة البيع الأصلية",
          value: item.saleReturn.sale.invoiceNumber,
        },
        { emoji: "💵", label: "قيمة المرتجع", value: formatMoney(item.total) },
        { emoji: "🔢", label: "IMEI", value: row.imeiLabel },
      ],
    });
  }

  if (serial.purchaseItemId) {
    const purchaseReturnItems = await prisma.purchaseReturnItem.findMany({
      where: {
        purchaseItemId: serial.purchaseItemId,
        purchaseReturn: { branchId: serial.branchId },
      },
      select: {
        id: true,
        imeisSnapshot: true,
        total: true,
        purchaseReturn: {
          select: {
            id: true,
            returnNumber: true,
            returnDate: true,
            createdAt: true,
            purchase: {
              select: {
                id: true,
                invoiceNumber: true,
                supplier: { select: { nameAr: true } },
              },
            },
          },
        },
      },
      orderBy: { purchaseReturn: { returnDate: "asc" } },
    });

    for (const item of purchaseReturnItems) {
      const returnedImeis = getStoredDeviceImeis(item.imeisSnapshot);
      const matchesSerial =
        returnedImeis.length === 0 ||
        deviceImeis.some((imei) => returnedImeis.includes(imei));
      if (!matchesSerial) continue;

      events.push({
        id: `purchase-return-${item.id}`,
        type: "purchase_return",
        typeLabel: TYPE_LABELS.purchase_return,
        direction: "out",
        documentNumber: item.purchaseReturn.returnNumber,
        date: item.purchaseReturn.returnDate.toISOString(),
        createdAt: item.purchaseReturn.createdAt.toISOString(),
        partyName: item.purchaseReturn.purchase.supplier.nameAr,
        detailUrl: `/dashboard/purchases/${item.purchaseReturn.purchase.id}`,
        summary: "مرتجع مشتريات — الجهاز اتشال من المخزون",
        fields: [
          { emoji: "📄", label: "رقم المرتجع", value: item.purchaseReturn.returnNumber },
          { emoji: "📅", label: "تاريخ المرتجع", value: formatDateTime(item.purchaseReturn.returnDate) },
          {
            emoji: "🧾",
            label: "فاتورة الشراء الأصلية",
            value: item.purchaseReturn.purchase.invoiceNumber,
          },
          { emoji: "🤝", label: "المورد", value: item.purchaseReturn.purchase.supplier.nameAr },
          { emoji: "💵", label: "قيمة المرتجع", value: formatMoney(item.total) },
          {
            emoji: "🔢",
            label: "IMEI",
            value: returnedImeis.length > 0 ? formatDeviceImeisLabel(returnedImeis) : row.imeiLabel,
          },
        ],
      });
    }
  }

  events.push(...stocktakeEvents);
  events.sort((a, b) => compareOldestFirst(a.date, a.createdAt, b.date, b.createdAt));
  return events;
}

export async function getImeiTimeline(
  branchId: string,
  rawImei: string
): Promise<ImeiTimelineResult | null> {
  const imei = rawImei.trim();
  if (!isValidImeiFormat(imei)) return null;

  const imeiRows = await prisma.productSerialImei.findMany({
    where: { branchId, imei },
    select: { serialId: true },
    orderBy: { createdAt: "asc" },
  });

  if (imeiRows.length === 0) return null;

  const serialIds = [...new Set(imeiRows.map((row) => row.serialId))];
  const serials = await prisma.productSerial.findMany({
    where: { id: { in: serialIds }, branchId },
    include: phoneSerialDetailsInclude(branchId),
    orderBy: [{ cycleIndex: "asc" }, { createdAt: "asc" }],
  });

  if (serials.length === 0) return null;

  const stocktakeMap = await loadStocktakeEventsBySerial(branchId, serials);
  const cycles: ImeiCycleBlock[] = [];

  for (const serial of serials) {
    const entryFields = buildEntryFields(serial);
    const events = await buildEventsForSerial(serial, stocktakeMap.get(serial.id) ?? []);
    const enteredAt =
      serial.purchaseItem?.purchase.purchaseDate.toISOString() ??
      serial.stockEntryItem?.stockEntry.entryDate.toISOString() ??
      serial.createdAt.toISOString();

    cycles.push({
      cycleIndex: serial.cycleIndex,
      serialId: serial.id,
      status: serial.status,
      statusLabel: statusLabel(serial.status),
      deviceImeis: getDeviceImeis(serial),
      enteredAt,
      entryFields,
      events,
    });
  }

  const latestSerial = [...serials].sort((a, b) => {
    if (b.cycleIndex !== a.cycleIndex) return b.cycleIndex - a.cycleIndex;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0]!;

  const device =
    latestSerial.status === "available" ? mapSerialToPhoneDeviceRow(latestSerial) : null;

  return {
    imei,
    cycles,
    current: {
      serialId: latestSerial.id,
      cycleIndex: latestSerial.cycleIndex,
      status: latestSerial.status,
      statusLabel: statusLabel(latestSerial.status),
      deviceImeis: getDeviceImeis(latestSerial),
      device,
      summaryFields: buildCurrentSummaryFields(latestSerial, device),
    },
  };
}

export function normalizeImeiSearchInput(value: string): string {
  return normalizeDeviceImeis([value])[0] ?? value.trim();
}
