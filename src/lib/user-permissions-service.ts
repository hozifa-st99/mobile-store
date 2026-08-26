import { prisma } from "@/lib/prisma";
import {
  AllowedScreens,
  isFullAccessRole,
  isSiteCurrentlyActive,
  ROLES,
  SITE_NOT_ACTIVATED_MESSAGE,
  ScreenKey,
  SCREEN_KEYS,
} from "@/lib/permissions";

export async function getAllowedScreensForUser(
  userId: string,
  role: string
): Promise<AllowedScreens> {
  if (isFullAccessRole(role)) return "all";

  const rows = await prisma.userScreenPermission.findMany({
    where: { userId, allowed: true },
    select: { screenKey: true },
  });

  return rows.map((r) => r.screenKey as ScreenKey);
}

export async function getBranchesForUser(
  userId: string,
  role: string,
  companyId: string
) {
  if (isFullAccessRole(role)) {
    return prisma.branch.findMany({
      where: { companyId, isActive: true },
      orderBy: { nameAr: "asc" },
    });
  }

  const links = await prisma.userBranch.findMany({
    where: { userId, branch: { isActive: true } },
    include: { branch: true },
  });

  return links.map((l) => l.branch);
}

export function mapBranchesResponse(
  branches: Array<{
    id: string;
    nameAr: string;
    address: string | null;
    phone: string | null;
  }>,
  defaultBranchId?: string | null
) {
  return branches.map((branch, index) => ({
    id: branch.id,
    name: branch.nameAr,
    address: branch.address,
    phone: branch.phone,
    isDefault: defaultBranchId ? branch.id === defaultBranchId : index === 0,
  }));
}

export async function assertSiteAccess(role: string, companyId: string) {
  if (role === ROLES.SUPER_ADMIN) return null;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { siteActivatedUntil: true },
  });

  if (!company || !isSiteCurrentlyActive(company.siteActivatedUntil)) {
    return SITE_NOT_ACTIVATED_MESSAGE;
  }

  return null;
}

export async function replaceUserScreenPermissions(
  userId: string,
  permissions: Array<{ screenKey: string; allowed: boolean }>
) {
  await prisma.userScreenPermission.deleteMany({ where: { userId } });

  const allowed = permissions.filter((p) => p.allowed && SCREEN_KEYS.includes(p.screenKey as ScreenKey));
  if (allowed.length === 0) return;

  await prisma.userScreenPermission.createMany({
    data: allowed.map((p) => ({
      userId,
      screenKey: p.screenKey,
      allowed: true,
    })),
  });
}

export async function replaceUserBranches(userId: string, branchIds: string[]) {
  await prisma.userBranch.deleteMany({ where: { userId } });

  if (branchIds.length === 0) return;

  await prisma.userBranch.createMany({
    data: branchIds.map((branchId, index) => ({
      userId,
      branchId,
      isDefault: index === 0,
    })),
  });
}

export function buildDefaultScreenPermissions(allOpen = false) {
  return SCREEN_KEYS.map((screenKey) => ({
    screenKey,
    allowed: allOpen,
  }));
}
