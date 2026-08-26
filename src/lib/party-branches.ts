import { prisma } from "@/lib/prisma";

export type PartyBranch = {
  id: string;
  nameAr: string;
};

function dedupeBranches(rows: { partyId: string; branch: PartyBranch }[]) {
  const byParty = new Map<string, Map<string, PartyBranch>>();

  for (const row of rows) {
    if (!row.partyId) continue;
    const branches = byParty.get(row.partyId) ?? new Map<string, PartyBranch>();
    branches.set(row.branch.id, row.branch);
    byParty.set(row.partyId, branches);
  }

  const result = new Map<string, PartyBranch[]>();
  for (const [partyId, branches] of byParty) {
    result.set(
      partyId,
      [...branches.values()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar"))
    );
  }
  return result;
}

/** فروع التعامل لعملاء الشركة — من فواتير البيع فقط (قراءة). */
export async function getCustomerBranchesMap(companyId: string, customerIds: string[]) {
  if (customerIds.length === 0) return new Map<string, PartyBranch[]>();

  const sales = await prisma.sale.findMany({
    where: {
      customerId: { in: customerIds },
      branch: { companyId },
    },
    select: {
      customerId: true,
      branch: { select: { id: true, nameAr: true } },
    },
  });

  return dedupeBranches(
    sales
      .filter((row): row is typeof row & { customerId: string } => row.customerId != null)
      .map((row) => ({
        partyId: row.customerId,
        branch: row.branch,
      }))
  );
}

/** فروع التعامل لموردي الشركة — من فواتير الشراء فقط (قراءة). */
export async function getSupplierBranchesMap(companyId: string, supplierIds: string[]) {
  if (supplierIds.length === 0) return new Map<string, PartyBranch[]>();

  const purchases = await prisma.purchase.findMany({
    where: {
      supplierId: { in: supplierIds },
      branch: { companyId },
    },
    select: {
      supplierId: true,
      branch: { select: { id: true, nameAr: true } },
    },
  });

  return dedupeBranches(
    purchases.map((row) => ({
      partyId: row.supplierId,
      branch: row.branch,
    }))
  );
}

export function attachPartyBranches<T extends { id: string }>(
  parties: T[],
  branchesMap: Map<string, PartyBranch[]>
) {
  return parties.map((party) => ({
    ...party,
    branches: branchesMap.get(party.id) ?? [],
  }));
}
