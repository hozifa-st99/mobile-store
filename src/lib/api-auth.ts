import { NextRequest } from "next/server";
import { verifyAccessToken, TokenPayload } from "./auth";
import {
  canManageUsers,
  hasScreenAccess,
  isSuperAdminRole,
  type ScreenKey,
} from "./permissions";
import { getAllowedScreensForUser } from "./user-permissions-service";

export async function getTokenPayloadFromRequest(
  request: NextRequest
): Promise<TokenPayload | null> {
  const token =
    request.cookies.get("accessToken")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) return null;
  return verifyAccessToken(token);
}

export async function getAuthFromRequest(
  request: NextRequest
): Promise<(TokenPayload & { branchId: string }) | null> {
  const payload = await getTokenPayloadFromRequest(request);
  if (!payload?.branchId) return null;
  return payload as TokenPayload & { branchId: string };
}

/** للإعدادات والرفع — يكفي companyId بدون فرع */
export async function getCompanyScopedAuthFromRequest(
  request: NextRequest
): Promise<(TokenPayload & { companyId: string }) | null> {
  const withBranch = await getAuthFromRequest(request);
  if (withBranch) return withBranch;
  return getCompanyAuthFromRequest(request);
}

export async function requireCompanyScopedAuth(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return { auth: null as null, error: unauthorizedResponse() };
  return { auth, error: null as null };
}

export async function requireScreenAccess(request: NextRequest, screenKey: ScreenKey) {
  const { auth, error } = await requireCompanyScopedAuth(request);
  if (error || !auth) return { auth: null as null, error: error! };

  const allowedScreens = await getAllowedScreensForUser(auth.userId, auth.role);
  if (!hasScreenAccess(auth.role, allowedScreens, screenKey)) {
    return { auth: null as null, error: forbiddenResponse() };
  }

  return { auth, error: null as null };
}

export async function getCompanyAuthFromRequest(
  request: NextRequest
): Promise<(TokenPayload & { companyId: string }) | null> {
  const payload = await getTokenPayloadFromRequest(request);
  if (!payload?.companyId) return null;
  return payload as TokenPayload & { companyId: string };
}

export async function requireCompanyAuth(request: NextRequest) {
  const auth = await getCompanyAuthFromRequest(request);
  if (!auth) return { auth: null as null, error: unauthorizedResponse() };
  return { auth, error: null as null };
}

export async function requireUserManager(request: NextRequest) {
  const result = await requireCompanyAuth(request);
  if (result.error) return result;
  if (!canManageUsers(result.auth.role)) {
    return { auth: null as null, error: forbiddenResponse() };
  }
  return result;
}

export async function requireSuperAdmin(request: NextRequest) {
  const result = await requireCompanyAuth(request);
  if (result.error) return result;
  if (!isSuperAdminRole(result.auth.role)) {
    return { auth: null as null, error: forbiddenResponse("هذه الصلاحية للسوبر أدمن فقط") };
  }
  return result;
}

export function unauthorizedResponse(message = "غير مصرح") {
  return Response.json({ message }, { status: 401 });
}

export function forbiddenResponse(message = "ليس لديك صلاحية") {
  return Response.json({ message }, { status: 403 });
}
