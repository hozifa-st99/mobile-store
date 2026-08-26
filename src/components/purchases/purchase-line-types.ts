import type { AccessoryPurchaseLine } from "@/components/purchases/AccessoryPurchaseLineItem";

import type { PhonePurchaseLine } from "@/components/purchases/PhonePurchaseLineItem";



export type PurchaseLineItem =

  | { lineType: "phone"; data: PhonePurchaseLine }

  | { lineType: "accessory"; data: AccessoryPurchaseLine };



export type ConfirmedPurchaseLine = PurchaseLineItem & { id: string };



/** الموبايل دائماً كمية 1 — IMEI المتعدد لنفس الجهاز (مثلاً dual SIM) */

export function phoneLineQuantity(_item: PhonePurchaseLine): number {

  return 1;

}



export function newLineId(): string {

  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

}

