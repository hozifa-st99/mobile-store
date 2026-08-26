export type BranchAvailabilityRow = {
  branchId: string;
  branchName: string;
  branchCode: string | null;
  quantity: number;
};

export type CatalogLeafAvailability = {
  currentBranchQty: number;
  otherBranches: BranchAvailabilityRow[];
  totalOtherQty: number;
  hasAnyStock: boolean;
};

export type PhoneModelVariantAvailability = {
  productId: string;
  color: string | null;
  storage: string | null;
  ram: string | null;
  label: string;
  availability: CatalogLeafAvailability;
};

export type PhoneCatalogAvailabilityModel = {
  id: string;
  name: string;
  availability: CatalogLeafAvailability;
  variants: PhoneModelVariantAvailability[];
};

export type PhoneCatalogAvailabilityEntry = {
  key: string;
  kind: "brand" | "platform";
  name: string;
  logoUrl: string | null;
  sortOrder: number;
  models: PhoneCatalogAvailabilityModel[];
};

export type ItemCatalogAvailabilityCategory = {
  id: string;
  name: string;
  logoUrl: string | null;
  brands: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    names: Array<{
      id: string;
      name: string;
      availability: CatalogLeafAvailability;
    }>;
  }>;
};

export type CatalogAvailabilityPayload = {
  currentBranch: { id: string; name: string; code: string | null };
  phoneCatalog: { entries: PhoneCatalogAvailabilityEntry[] };
  itemCatalog: { categories: ItemCatalogAvailabilityCategory[] };
};
