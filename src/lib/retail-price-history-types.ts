export interface RetailPriceChangeRow {
  id: string;
  changedAt: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
  userName: string | null;
  serialId: string | null;
  imei: string | null;
  firstSaleAfter: {
    invoiceNumber: string;
    saleDate: string;
    detailUrl: string;
    unitPrice: number;
  } | null;
}

export interface ProductInvoiceRow {
  id: string;
  type: "purchase" | "stock_entry" | "sale";
  typeLabel: string;
  documentNumber: string;
  date: string;
  detailUrl: string;
  quantity: number;
  unitPrice: number;
  retailPrice: number | null;
  counterparty: string | null;
  imei: string | null;
}

export interface ProductRetailPriceHistory {
  productId: string;
  productName: string;
  brand: string;
  productType: string;
  currentPurchasePrice: number;
  currentRetailPrice: number;
  changes: RetailPriceChangeRow[];
  changedImeis: string[];
  invoices: ProductInvoiceRow[];
}
