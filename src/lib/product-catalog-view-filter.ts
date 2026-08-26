export type CatalogViewTab = "all" | "phones" | "accessory";

export interface CatalogViewFilterFields {
  type: string;
  phonePlatformId?: string | null;
  phoneBrandId?: string | null;
}

export interface CatalogViewFilterState {
  tab: CatalogViewTab;
  platformId: string;
  phoneBrandId: string;
}

export const defaultCatalogViewFilter: CatalogViewFilterState = {
  tab: "all",
  platformId: "",
  phoneBrandId: "",
};

export function applyCatalogViewFilter<T extends CatalogViewFilterFields>(
  list: T[],
  filter: CatalogViewFilterState
): T[] {
  let result = list;

  if (filter.tab === "phones") {
    result = result.filter((item) => item.type === "phone");
  } else if (filter.tab === "accessory") {
    result = result.filter((item) => item.type === "accessory");
  }

  if (filter.tab === "phones" && filter.platformId) {
    result = result.filter((item) => item.phonePlatformId === filter.platformId);
  }

  if (filter.tab === "phones" && filter.phoneBrandId) {
    result = result.filter((item) => item.phoneBrandId === filter.phoneBrandId);
  }

  return result;
}
