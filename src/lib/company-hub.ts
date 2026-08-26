/** مسارات تعمل على مستوى الشركة بدون اختيار فرع */
export function isCompanyHubSettingsPath(pathname: string): boolean {
  return pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/");
}

export function isCompanyHubCustomersPath(pathname: string): boolean {
  return pathname === "/dashboard/customers" || pathname.startsWith("/dashboard/customers/");
}

export function isCompanyHubBranchesPath(pathname: string): boolean {
  return pathname === "/branches" || pathname.startsWith("/branches/");
}

export function isCompanyHubDebtsPath(pathname: string): boolean {
  return pathname === "/debts" || pathname.startsWith("/debts/");
}

export function isCompanyHubBranchComparisonPath(pathname: string): boolean {
  return pathname === "/branch-comparison" || pathname.startsWith("/branch-comparison/");
}

export function isCompanyHubPath(pathname: string): boolean {
  return (
    isCompanyHubSettingsPath(pathname) ||
    isCompanyHubCustomersPath(pathname) ||
    isCompanyHubDebtsPath(pathname) ||
    isCompanyHubBranchesPath(pathname) ||
    isCompanyHubBranchComparisonPath(pathname)
  );
}
