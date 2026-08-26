export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EMPLOYEE: "employee",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const APP_SCREENS = [
  { key: "dashboard", label: "الرئيسية", path: "/dashboard" },
  { key: "sales_new", label: "فاتورة مبيعات", path: "/dashboard/sales/new" },
  { key: "sales_returns", label: "مرتجع مبيعات", path: "/dashboard/sales/returns" },
  { key: "sales_list", label: "استعراض فواتير المبيعات", path: "/dashboard/sales" },
  { key: "purchases_new", label: "فاتورة مشتريات", path: "/dashboard/purchases/new" },
  { key: "purchases_returns", label: "مرتجع مشتريات", path: "/dashboard/purchases/returns" },
  { key: "purchases_list", label: "استعراض فواتير المشتريات", path: "/dashboard/purchases" },
  { key: "purchases_debts", label: "الأجل والمديونات — مشتريات", path: "/dashboard/purchases/debts" },
  { key: "expenses", label: "المصروفات", path: "/dashboard/expenses" },
  { key: "products", label: "المنتجات", path: "/dashboard/products" },
  { key: "inventory", label: "المخزون", path: "/dashboard/inventory" },
  { key: "stocktake", label: "تسوية / جرد", path: "/dashboard/inventory/stocktake" },
  { key: "imei_tracker", label: "تتبع IMEI", path: "/dashboard/inventory/imei-tracker" },
  { key: "maintenance", label: "الصيانة", path: "/dashboard/maintenance" },
  { key: "documents", label: "سجل الحركات", path: "/dashboard/documents" },
  { key: "treasury", label: "تقفيل الوردية", path: "/dashboard/treasury" },
  { key: "treasury_deposits", label: "سجل التوريدات السابقة", path: "/dashboard/treasury/deposits" },
  { key: "branch_vault", label: "خزنة الفرع", path: "/dashboard/treasury/vault" },
  { key: "reports", label: "التقارير والتحليلات", path: "/dashboard/reports" },
  { key: "reports", label: "مقارنة أداء الفروع", path: "/branch-comparison" },
  { key: "customers", label: "العملاء", path: "/dashboard/customers" },
  { key: "branch_employees", label: "الموظفين", path: "/dashboard/branch-employees" },
  { key: "branch_employees_report", label: "تقرير الموظفين", path: "/dashboard/branch-employees/report" },
  { key: "debts", label: "الديون والأجل", path: "/debts" },
  { key: "suppliers", label: "الموردين", path: "/dashboard/settings/suppliers" },
  { key: "settings", label: "الإعدادات", path: "/dashboard/settings" },
  { key: "settings_phone_catalog", label: "قائمة الموبايلات", path: "/dashboard/settings/phone-catalog" },
  { key: "settings_item_catalog", label: "قائمة الأصناف", path: "/dashboard/settings/item-catalog" },
  { key: "settings_branches", label: "الفروع", path: "/dashboard/settings/branches" },
  { key: "settings_users", label: "المستخدمين", path: "/dashboard/settings/users" },
  { key: "settings_notifications", label: "التنبيهات", path: "/dashboard/settings/notifications" },
  { key: "settings_print", label: "إعدادات الطباعة", path: "/dashboard/settings/print" },
] as const;

export type ScreenKey = (typeof APP_SCREENS)[number]["key"];

export const SCREEN_KEYS = APP_SCREENS.map((s) => s.key);

const PATH_TO_SCREEN = [...APP_SCREENS]
  .sort((a, b) => b.path.length - a.path.length)
  .reduce<Record<string, ScreenKey>>((acc, screen) => {
    acc[screen.path] = screen.key;
    return acc;
  }, {});

export function isSuperAdminRole(role: string): boolean {
  return role === ROLES.SUPER_ADMIN;
}

export function isAdminRole(role: string): boolean {
  return role === ROLES.ADMIN || role === "system_admin";
}

export function isFullAccessRole(role: string): boolean {
  return isSuperAdminRole(role) || isAdminRole(role);
}

export function canManageUsers(role: string): boolean {
  return isSuperAdminRole(role) || isAdminRole(role);
}

export type AllowedScreens = ScreenKey[] | "all";

export function hasScreenAccess(
  role: string,
  allowedScreens: AllowedScreens | undefined,
  screenKey: ScreenKey
): boolean {
  if (isFullAccessRole(role)) return true;
  if (allowedScreens === "all") return true;
  if (!Array.isArray(allowedScreens)) return false;
  return allowedScreens.includes(screenKey);
}

export function pathnameToScreenKey(pathname: string): ScreenKey | null {
  if (PATH_TO_SCREEN[pathname]) return PATH_TO_SCREEN[pathname];

  const sorted = [...APP_SCREENS].sort((a, b) => b.path.length - a.path.length);
  for (const screen of sorted) {
    if (screen.path === "/dashboard") continue;
    if (pathname === screen.path || pathname.startsWith(`${screen.path}/`)) {
      return screen.key;
    }
  }

  if (pathname === "/dashboard") return "dashboard";
  return null;
}

export function canAccessPathname(
  role: string,
  allowedScreens: AllowedScreens | undefined,
  pathname: string
): boolean {
  const key = pathnameToScreenKey(pathname);
  if (!key) return isFullAccessRole(role);
  return hasScreenAccess(role, allowedScreens, key);
}

export const SITE_NOT_ACTIVATED_MESSAGE =
  "رجاء تواصل مع المهندس في اقرب وقت لعمل التحديثات اللازمة";

export const LIFETIME_ACTIVATION_DATE = new Date("2099-12-31T23:59:59.999Z");

export const ACTIVATION_PERIODS = [
  { key: "day", label: "يوم واحد", days: 1 },
  { key: "week", label: "أسبوع", days: 7 },
  { key: "month", label: "شهر", days: 30 },
  { key: "quarter", label: "ربع سنة", days: 91 },
  { key: "half", label: "نصف سنة", days: 182 },
  { key: "year", label: "سنة", days: 365 },
  { key: "lifetime", label: "مدى الحياة", days: null },
] as const;

export type ActivationPeriodKey = (typeof ACTIVATION_PERIODS)[number]["key"];

export function computeActivationUntil(
  period: ActivationPeriodKey | "custom" | "lifetime",
  customDays?: number
): Date {
  if (period === "lifetime") {
    return LIFETIME_ACTIVATION_DATE;
  }

  const now = new Date();
  if (period === "custom") {
    const days = Math.max(1, Math.min(3650, customDays ?? 1));
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }
  const preset = ACTIVATION_PERIODS.find((p) => p.key === period);
  const days = preset?.days ?? 1;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isLifetimeActivation(activatedUntil: Date | null | undefined): boolean {
  if (!activatedUntil) return false;
  return activatedUntil.getTime() >= new Date("2090-01-01T00:00:00.000Z").getTime();
}

export function formatActivationExpiry(activatedUntil: Date | string | null | undefined): string {
  if (!activatedUntil) return "";
  const date = typeof activatedUntil === "string" ? new Date(activatedUntil) : activatedUntil;
  if (isLifetimeActivation(date)) return "مدى الحياة";
  return date.toLocaleString("ar-EG");
}

export function isSiteCurrentlyActive(activatedUntil: Date | null | undefined): boolean {
  if (!activatedUntil) return false;
  return activatedUntil.getTime() > Date.now();
}
