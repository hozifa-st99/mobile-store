import type { Prisma } from "@prisma/client";

export async function allocateBranchEmployeeCode(
  tx: Prisma.TransactionClient,
  branchId: string
): Promise<string> {
  const employees = await tx.branchEmployee.findMany({
    where: { branchId },
    select: { employeeCode: true },
  });

  let max = 0;
  for (const row of employees) {
    const n = Number.parseInt(row.employeeCode, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }

  return String(max + 1).padStart(3, "0");
}
