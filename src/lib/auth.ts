import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret"
);
const JWT_REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || "fallback-refresh-secret"
);

export interface TokenPayload {
  userId: string;
  username: string;
  fullName: string;
  fullNameAr: string;
  role: string;
  companyId: string;
  branchId?: string;
  branchName?: string;
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyAccessToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return payload as { userId: string };
  } catch {
    return null;
  }
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "سوبر أدمن",
  admin: "أدمن",
  employee: "موظف",
  system_admin: "أدمن",
  company_owner: "مالك الشركة",
  branch_manager: "مدير الفرع",
  cashier: "كاشير",
  seller: "بائع",
  warehouse: "مسؤول المخزن",
  accountant: "محاسب",
};
