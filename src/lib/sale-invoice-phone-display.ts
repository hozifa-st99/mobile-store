import {
  boxConditionLabel,
  deviceConditionLabel,
  taxStatusLabel,
} from "@/lib/phone-device-display";
import type { PhoneDeviceRow } from "@/lib/phone-device-serial-details";

/** حقول عرض فقط — لا تُستخدم في حسابات الفاتورة */
export interface SaleInvoicePhoneDisplay {
  deviceConditionLabel: string;
  color: string | null;
  storage: string | null;
  taxStatusLabel: string;
  batteryPercent: number | null;
  boxConditionLabel: string | null;
}

type ProductPhoneFields = {
  deviceCondition: string;
  color: string | null;
  storage: string | null;
  taxStatus: string;
  batteryPercent: number | null;
  boxCondition: string | null;
};

function buildFromFields(fields: {
  deviceCondition: string;
  color: string | null;
  storage: string | null;
  taxStatus: string;
  batteryPercent: number | null;
  boxCondition: string | null;
}): SaleInvoicePhoneDisplay {
  const isUsed = fields.deviceCondition === "used";
  return {
    deviceConditionLabel: deviceConditionLabel(fields.deviceCondition),
    color: fields.color,
    storage: fields.storage,
    taxStatusLabel: taxStatusLabel(fields.taxStatus),
    batteryPercent: isUsed ? fields.batteryPercent : null,
    boxConditionLabel: isUsed ? boxConditionLabel(fields.boxCondition) : null,
  };
}

export function saleInvoicePhoneDisplayFromDeviceRow(
  row: PhoneDeviceRow
): SaleInvoicePhoneDisplay {
  return buildFromFields({
    deviceCondition: row.details.deviceCondition,
    color: row.details.color,
    storage: row.details.storage,
    taxStatus: row.details.taxStatus,
    batteryPercent: row.details.batteryPercent,
    boxCondition: row.details.boxCondition,
  });
}

export function saleInvoicePhoneDisplayFromProduct(
  product: ProductPhoneFields
): SaleInvoicePhoneDisplay {
  return buildFromFields({
    deviceCondition: product.deviceCondition,
    color: product.color,
    storage: product.storage,
    taxStatus: product.taxStatus,
    batteryPercent: product.batteryPercent,
    boxCondition: product.boxCondition,
  });
}
