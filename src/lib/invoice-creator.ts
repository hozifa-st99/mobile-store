export interface InvoiceCreatorInfo {
  id: string;
  username: string;
  fullNameAr: string | null;
}

const CREATOR_AVATAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#db2777",
  "#4f46e5",
  "#0d9488",
] as const;

export function pickCreatorAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash + username.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return CREATOR_AVATAR_COLORS[hash % CREATOR_AVATAR_COLORS.length];
}

export function creatorBadgeLabel(username: string): string {
  const trimmed = username.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(0, 3);
}

/** اسم الحساب (الاسم العربي) — ليس username */
export function invoiceCreatorAccountName(
  creator: Pick<InvoiceCreatorInfo, "fullNameAr"> | null | undefined
): string | null {
  const name = creator?.fullNameAr?.trim();
  return name || null;
}

export function serializeInvoiceCreator(
  user: { id: string; username: string; fullNameAr: string } | null | undefined
): InvoiceCreatorInfo | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullNameAr: user.fullNameAr,
  };
}

export const invoiceCreatorSelect = {
  id: true,
  username: true,
  fullNameAr: true,
} as const;
