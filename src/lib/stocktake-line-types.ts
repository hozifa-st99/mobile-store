export interface StocktakeSerialLine {
  id: string;
  productId?: string;
  imei: string | null;
  imeis?: string[];
  barcode: string | null;
  unitCost: number;
  present?: boolean;
}

export interface StocktakeLineMember {
  productId: string;
  systemQuantity: number;
  unitCost: number;
}

export interface StocktakeLine {
  lineId: string;
  productId: string;
  productIds: string[];
  groupKey?: string | null;
  members?: StocktakeLineMember[];
  name: string;
  brand: string;
  productType: string;
  phoneBrandId?: string | null;
  phoneBrandName?: string | null;
  itemCategoryId?: string | null;
  itemCategoryName?: string | null;
  barcode: string | null;
  imeis: string[];
  serials: StocktakeSerialLine[];
  details: string;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
  unitCost: number;
}

export interface StocktakeSubmitSerialPayload {
  id: string;
  imei: string | null;
  imeis: string[];
  barcode: string | null;
  unitCost: number;
  present: boolean;
}

export interface StocktakeSubmitItemPayload {
  productId: string;
  description: string;
  barcode: string | null;
  imeis: string[];
  serials?: StocktakeSubmitSerialPayload[];
  presentSerialIds?: string[];
  absentSerialIds?: string[];
  systemQuantity: number;
  countedQuantity: number;
  unitCost: number;
}

export type StocktakeProductFilter = "all" | "phone" | "accessory";
