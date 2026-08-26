export type CatalogAvailabilitySerialUnit = {
  serialId: string;
  imeis: string[];
  imeiLabel: string;
  deviceCondition: string;
  deviceConditionLabel: string;
  retailPrice: number;
  branchId: string;
  branchName: string;
  branchCode: string | null;
  color: string | null;
  storage: string | null;
  ram: string | null;
  variantLabel: string;
};

export type CatalogAvailabilitySerialsPayload = {
  title: string;
  subtitle: string;
  units: CatalogAvailabilitySerialUnit[];
};
