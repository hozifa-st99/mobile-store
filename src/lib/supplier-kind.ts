export const SUPPLIER_KIND_WHOLESALE = "wholesale";
export const SUPPLIER_KIND_INDIVIDUAL_CUSTOMER = "individual_customer";

export type PurchaseCounterpartyMode = "wholesale" | "customer";

export function isWholesaleSupplierKind(kind: string | null | undefined) {
  return !kind || kind === SUPPLIER_KIND_WHOLESALE;
}

export function isIndividualCustomerSupplierKind(kind: string | null | undefined) {
  return kind === SUPPLIER_KIND_INDIVIDUAL_CUSTOMER;
}
