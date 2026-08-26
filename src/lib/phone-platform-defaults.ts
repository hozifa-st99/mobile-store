import { prisma } from "@/lib/prisma";

/** iPhone → models directly; Android → brands → models */
export async function ensureDefaultPhonePlatforms(companyId: string) {
  const existing = await prisma.phonePlatform.findMany({
    where: { companyId, isActive: true },
    select: { requiresBrand: true },
  });

  const hasDirectModels = existing.some((p) => !p.requiresBrand);
  const hasBrandHierarchy = existing.some((p) => p.requiresBrand);

  const toCreate: Array<{
    companyId: string;
    nameAr: string;
    requiresBrand: boolean;
    sortOrder: number;
  }> = [];

  if (!hasDirectModels) {
    toCreate.push({
      companyId,
      nameAr: "iPhone",
      requiresBrand: false,
      sortOrder: 0,
    });
  }

  if (!hasBrandHierarchy) {
    toCreate.push({
      companyId,
      nameAr: "Android",
      requiresBrand: true,
      sortOrder: 1,
    });
  }

  if (toCreate.length === 0) return;

  await prisma.phonePlatform.createMany({ data: toCreate });
}
