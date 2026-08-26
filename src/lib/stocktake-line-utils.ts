import type {
  StocktakeLine,
  StocktakeLineMember,
  StocktakeSerialLine,
  StocktakeSubmitItemPayload,
} from "@/lib/stocktake-line-types";
import { formatAmountExact } from "@/lib/utils";

/** Reconstruct expandable serial rows from saved IMEI snapshot (detail view). */
export function buildSerialsFromImeis(
  productId: string,
  imeis: string[],
  barcode: string | null,
  unitCost: number
): StocktakeSerialLine[] {
  return imeis.map((imei, index) => {
    const trimmed = imei.trim();
    return {
      id: `${productId}-${index}`,
      productId,
      imei: trimmed || null,
      imeis: trimmed ? [trimmed] : [],
      barcode,
      unitCost,
      present: true,
    };
  });
}

export function initializeStocktakeSerials(serials: StocktakeSerialLine[]): StocktakeSerialLine[] {
  return serials.map((serial) => ({
    ...serial,
    present: serial.present ?? true,
  }));
}

export function isPhoneStocktakeLine(line: StocktakeLine): boolean {
  return line.productType === "phone" && line.serials.length > 0;
}

export function recomputePhoneLineFromSerials(line: StocktakeLine): StocktakeLine {
  if (!isPhoneStocktakeLine(line)) return line;

  const serials = initializeStocktakeSerials(line.serials);
  const systemQuantity = serials.length;
  const countedQuantity = serials.filter((serial) => serial.present !== false).length;
  const unitCost =
    serials.length > 0
      ? serials.reduce((sum, serial) => sum + serial.unitCost, 0) / serials.length
      : line.unitCost;

  return {
    ...line,
    serials,
    systemQuantity,
    countedQuantity,
    variance: countedQuantity - systemQuantity,
    unitCost,
  };
}

export function formatStocktakeUnitCost(line: StocktakeLine): string {
  const serials = line.serials.filter((serial) => serial.unitCost > 0);
  if (serials.length === 0) return formatAmountExact(line.unitCost);

  const costs = serials.map((serial) => serial.unitCost);
  const min = Math.min(...costs);
  const max = Math.max(...costs);
  if (Math.abs(min - max) < 0.01) return formatAmountExact(min);
  return `${formatAmountExact(min)} – ${formatAmountExact(max)}`;
}

/** Monetary stocktake adjustment: accessories = variance × unit cost; phones = missing IMEI costs. */
export function computeStocktakeAdjustmentAmount(line: StocktakeLine): number {
  if (isPhoneStocktakeLine(line)) {
    const missingSerials = line.serials.filter((serial) => serial.present === false);
    if (missingSerials.length > 0) {
      return -missingSerials.reduce((sum, serial) => sum + serial.unitCost, 0);
    }
    return 0;
  }

  const variance = line.countedQuantity - line.systemQuantity;
  return variance * line.unitCost;
}

export function formatStocktakeAdjustmentAmount(amount: number): string {
  if (Math.abs(amount) < 0.005) return formatAmountExact(0);
  const formatted = formatAmountExact(Math.abs(amount));
  return amount > 0 ? `+${formatted}` : `-${formatted}`;
}

export function sumStocktakeAdjustmentAmount(lines: StocktakeLine[]): number {
  return lines.reduce((sum, line) => sum + computeStocktakeAdjustmentAmount(line), 0);
}

export function filterStocktakeLinesByType(
  lines: StocktakeLine[],
  filter: "all" | "phone" | "accessory"
): StocktakeLine[] {
  if (filter === "all") return lines;
  if (filter === "phone") return lines.filter((line) => line.productType === "phone");
  return lines.filter((line) => line.productType !== "phone");
}

function matchesStocktakeSearch(line: StocktakeLine, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (line.name.toLowerCase().includes(q)) return true;
  if (line.brand.toLowerCase().includes(q)) return true;
  if (line.phoneBrandName?.toLowerCase().includes(q)) return true;
  if (line.itemCategoryName?.toLowerCase().includes(q)) return true;
  if (line.barcode?.toLowerCase().includes(q)) return true;
  if (line.imeis.some((imei) => imei.toLowerCase().includes(q))) return true;
  if (line.serials.some((serial) => serial.barcode?.toLowerCase().includes(q))) return true;
  return false;
}

export function getPhoneBrandFilterKey(line: StocktakeLine): string | null {
  if (line.productType !== "phone") return null;
  if (line.phoneBrandId) return line.phoneBrandId;
  const name = line.phoneBrandName?.trim() || line.brand?.trim();
  return name ? `name:${name}` : null;
}

export function getAccessoryCategoryFilterKey(line: StocktakeLine): string | null {
  if (line.productType === "phone") return null;
  if (line.itemCategoryId) return line.itemCategoryId;
  const name = line.itemCategoryName?.trim();
  return name ? `name:${name}` : null;
}

export function extractPhoneBrandFilterOptions(
  lines: StocktakeLine[]
): Array<{ id: string; name: string }> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const key = getPhoneBrandFilterKey(line);
    if (!key) continue;
    const name = line.phoneBrandName?.trim() || line.brand?.trim() || "غير محدد";
    map.set(key, name);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function extractAccessoryCategoryFilterOptions(
  lines: StocktakeLine[]
): Array<{ id: string; name: string }> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const key = getAccessoryCategoryFilterKey(line);
    if (!key) continue;
    const name = line.itemCategoryName?.trim() || "غير محدد";
    map.set(key, name);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function applyStocktakeLineFilters(
  lines: StocktakeLine[],
  options: {
    search?: string;
    typeFilter?: "all" | "phone" | "accessory";
    subFilter?: string;
  }
): StocktakeLine[] {
  let result = lines;
  const typeFilter = options.typeFilter ?? "all";

  if (typeFilter !== "all") {
    result = filterStocktakeLinesByType(result, typeFilter);
  }

  if (options.subFilter) {
    if (typeFilter === "phone") {
      result = result.filter((line) => getPhoneBrandFilterKey(line) === options.subFilter);
    } else if (typeFilter === "accessory") {
      result = result.filter((line) => getAccessoryCategoryFilterKey(line) === options.subFilter);
    }
  }

  const search = options.search?.trim();
  if (search) {
    result = result.filter((line) => matchesStocktakeSearch(line, search));
  }

  return result;
}

export function buildPhoneGroupKey(input: {
  phoneModelId?: string | null;
  name: string;
  brand: string;
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  deviceCondition?: string | null;
  boxCondition?: string | null;
  batteryPercent?: number | null;
}): string {
  if (input.phoneModelId) {
    return [
      input.phoneModelId,
      input.color ?? "",
      input.storage ?? "",
      input.ram ?? "",
      input.deviceCondition ?? "new",
      input.boxCondition ?? "",
      input.batteryPercent ?? "",
    ].join("|");
  }

  return [
    input.brand,
    input.name,
    input.color ?? "",
    input.storage ?? "",
    input.ram ?? "",
    input.deviceCondition ?? "new",
    input.boxCondition ?? "",
    input.batteryPercent ?? "",
  ].join("|");
}

export function buildPhoneGroupDetails(displayName: string, deviceCount: number): string {
  const parts = [displayName];
  if (deviceCount > 0) {
    parts.push(`${deviceCount} جهاز · اضغط لعرض الباركود و IMEI`);
  }
  return parts.join("\n");
}

function buildMemberDescription(line: StocktakeLine, member: StocktakeLineMember): string {
  const serials = line.serials.filter((serial) => serial.productId === member.productId);
  const parts = [line.details.split("\n")[0] || line.name];

  for (const serial of serials) {
    const barcode = serial.barcode?.trim();
    if (barcode) parts.push(`باركود: ${barcode}`);

    const imeis = serial.imeis ?? (serial.imei ? [serial.imei] : []);
    if (imeis.length === 1) parts.push(`IMEI: ${imeis[0]}`);
    else if (imeis.length > 1) parts.push(`IMEI: ${imeis.join(" / ")}`);
  }

  return parts.join("\n");
}

export function groupPhoneStocktakeLines(lines: StocktakeLine[]): StocktakeLine[] {
  const accessories: StocktakeLine[] = [];
  const phoneGroups = new Map<string, StocktakeLine[]>();

  for (const line of lines) {
    if (line.productType !== "phone" || !line.groupKey) {
      accessories.push({
        ...line,
        lineId: line.lineId || line.productId,
        productIds: line.productIds?.length ? line.productIds : [line.productId],
      });
      continue;
    }

    const bucket = phoneGroups.get(line.groupKey) ?? [];
    bucket.push(line);
    phoneGroups.set(line.groupKey, bucket);
  }

  const groupedPhones: StocktakeLine[] = [];

  for (const [groupKey, members] of phoneGroups) {
    if (members.length === 1) {
      const line = recomputePhoneLineFromSerials({
        ...members[0],
        lineId: members[0].productId,
        productIds: [members[0].productId],
        members: [
          {
            productId: members[0].productId,
            systemQuantity: members[0].systemQuantity,
            unitCost: members[0].unitCost,
          },
        ],
        details: buildPhoneGroupDetails(
          members[0].details.split("\n")[0] || members[0].name,
          members[0].serials.length > 0 ? members[0].serials.length : members[0].systemQuantity
        ),
      });
      groupedPhones.push(line);
      continue;
    }

    const serials = initializeStocktakeSerials(
      members.flatMap((member) =>
        member.serials.map((serial) => ({ ...serial, productId: member.productId }))
      )
    );
    const displayName = members[0].details.split("\n")[0] || members[0].name;
    const deviceCount = serials.length > 0 ? serials.length : members.reduce((sum, member) => sum + member.systemQuantity, 0);

    groupedPhones.push(
      recomputePhoneLineFromSerials({
        lineId: `phone:${groupKey}`,
        productId: `phone:${groupKey}`,
        productIds: members.map((member) => member.productId),
        groupKey,
        members: members.map((member) => ({
          productId: member.productId,
          systemQuantity:
            member.serials.length > 0
              ? member.serials.length
              : member.systemQuantity,
          unitCost:
            member.serials.length > 0
              ? member.serials.reduce((sum, serial) => sum + serial.unitCost, 0) /
                member.serials.length
              : member.unitCost,
        })),
        name: members[0].name,
        brand: members[0].brand,
        productType: "phone",
        phoneBrandId: members[0].phoneBrandId,
        phoneBrandName: members[0].phoneBrandName,
        itemCategoryId: null,
        itemCategoryName: null,
        barcode: null,
        imeis: serials.flatMap((serial) => serial.imeis ?? (serial.imei ? [serial.imei] : [])),
        serials,
        details: buildPhoneGroupDetails(displayName, deviceCount),
        systemQuantity: deviceCount,
        countedQuantity: deviceCount,
        variance: 0,
        unitCost: members[0].unitCost,
      })
    );
  }

  return [...groupedPhones, ...accessories];
}

function countedSerialsForProduct(line: StocktakeLine, productId: string): number {
  return line.serials.filter(
    (serial) => serial.productId === productId && serial.present !== false
  ).length;
}

function unitCostForProduct(line: StocktakeLine, productId: string, fallback: number): number {
  const serials = line.serials.filter((serial) => serial.productId === productId);
  if (serials.length === 0) return fallback;
  return serials.reduce((sum, serial) => sum + serial.unitCost, 0) / serials.length;
}

export function expandStocktakeLinesForSubmit(
  lines: StocktakeLine[]
): StocktakeSubmitItemPayload[] {
  const items: StocktakeSubmitItemPayload[] = [];

  for (const line of lines) {
    if (isPhoneStocktakeLine(line)) {
      const productIds =
        line.productIds.length > 0
          ? line.productIds
          : [line.serials[0]?.productId ?? line.productId].filter(Boolean);

      for (const productId of productIds) {
        const productSerials = line.serials.filter((serial) => serial.productId === productId);
        const member = line.members?.find((entry) => entry.productId === productId);
        const fallbackSystem = member?.systemQuantity ?? line.systemQuantity;
        const fallbackCost = member?.unitCost ?? line.unitCost;
        const systemQuantity =
          productSerials.length > 0 ? productSerials.length : fallbackSystem;
        const countedQuantity =
          productSerials.length > 0
            ? countedSerialsForProduct(line, productId)
            : line.countedQuantity;
        const imeis = productSerials.flatMap(
          (serial) => serial.imeis ?? (serial.imei ? [serial.imei] : [])
        );
        const presentSerialIds = productSerials
          .filter((serial) => serial.present !== false)
          .map((serial) => serial.id);
        const absentSerialIds = productSerials
          .filter((serial) => serial.present === false)
          .map((serial) => serial.id);
        const barcode = productSerials.find((serial) => serial.barcode)?.barcode ?? null;
        const serialSnapshots = productSerials.map((serial) => ({
          id: serial.id,
          imei: serial.imei,
          imeis: serial.imeis ?? (serial.imei ? [serial.imei] : []),
          barcode: serial.barcode,
          unitCost: serial.unitCost,
          present: serial.present !== false,
        }));
        const unitCost =
          serialSnapshots.length > 0
            ? serialSnapshots.reduce((sum, serial) => sum + serial.unitCost, 0) /
              serialSnapshots.length
            : unitCostForProduct(line, productId, fallbackCost);
        const memberInfo: StocktakeLineMember = {
          productId,
          systemQuantity,
          unitCost,
        };

        items.push({
          productId,
          description: buildMemberDescription(line, memberInfo),
          barcode,
          imeis,
          serials: serialSnapshots,
          presentSerialIds,
          absentSerialIds,
          systemQuantity,
          countedQuantity,
          unitCost,
        });
      }
      continue;
    }

    const productId = line.productIds?.[0] ?? line.productId;
    items.push({
      productId,
      description: line.details,
      barcode: line.barcode,
      imeis: line.imeis,
      systemQuantity: line.systemQuantity,
      countedQuantity: line.countedQuantity,
      unitCost: line.unitCost,
    });
  }

  return items;
}
