/** بيانات عرض الشركة — اسم ولوجo (عرض فقط) */

export interface CompanyBranding {
  nameAr: string;
  logoUrl: string | null;
}

export const DEFAULT_COMPANY_DISPLAY_NAME = "MOBILE STORE";

export function normalizeCompanyBranding(
  company: { nameAr: string; logoUrl?: string | null } | null | undefined
): CompanyBranding {
  const nameAr = company?.nameAr?.trim();
  const logoUrl = company?.logoUrl?.trim();
  return {
    nameAr: nameAr || DEFAULT_COMPANY_DISPLAY_NAME,
    logoUrl: logoUrl || null,
  };
}

export async function loadSingleCompanyBranding(
  db: { company: { findFirst: (args: object) => Promise<{ nameAr: string; logoUrl: string | null } | null> } }
): Promise<CompanyBranding> {
  const company = await db.company.findFirst({
    select: { nameAr: true, logoUrl: true },
    orderBy: { createdAt: "asc" },
  });
  return normalizeCompanyBranding(company);
}
