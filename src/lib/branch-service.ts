import type { Prisma } from "@prisma/client";

import { sanitizeBranchCode } from "@/lib/branch-code";

type Db = Prisma.TransactionClient | { sale: { count: (args: object) => Promise<number> }; purchase: { count: (args: object) => Promise<number> }; branchInventory: { count: (args: object) => Promise<number> }; expense: { count: (args: object) => Promise<number> }; stockEntry: { count: (args: object) => Promise<number> }; maintenanceOrder: { count: (args: object) => Promise<number> } };

export function normalizeBranchCodeInput(raw: string): string {
  return sanitizeBranchCode(raw);
}

export function validateBranchCode(raw: string): string | null {
  const code = normalizeBranchCodeInput(raw);
  if (code.length < 2) return "كود الفرع مطلوب (حرفين على الأقل — مثل MAD أو MAIN)";
  if (code.length > 6) return "كود الفرع طويل جداً (6 أحرف كحد أقصى)";
  return null;
}

export async function branchHasActivity(db: Db, branchId: string): Promise<boolean> {
  const counts = await Promise.all([
    db.sale.count({ where: { branchId } }),
    db.purchase.count({ where: { branchId } }),
    db.branchInventory.count({ where: { branchId } }),
    db.expense.count({ where: { branchId } }),
    db.stockEntry.count({ where: { branchId } }),
    db.maintenanceOrder.count({ where: { branchId } }),
  ]);
  return counts.some((count) => count > 0);
}

export function formatBranchForClient(branch: {
  id: string;
  name: string;
  nameAr: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: branch.id,
    name: branch.nameAr,
    nameAr: branch.nameAr,
    code: branch.code ? resolveDisplayCode(branch.code) : null,
    address: branch.address,
    phone: branch.phone,
    isActive: branch.isActive,
    createdAt: branch.createdAt.toISOString(),
  };
}

function resolveDisplayCode(code: string) {
  return normalizeBranchCodeInput(code);
}
