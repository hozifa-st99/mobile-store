/** كود فرع قصير للتضمين في أرقام الفواتير — 2–6 أحرف/أرقام */

export function sanitizeBranchCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function resolveBranchCode(branch: {
  code?: string | null;
  id: string;
}): string {
  const manual = branch.code ? sanitizeBranchCode(branch.code) : "";
  if (manual.length >= 2) return manual;

  const idMatch = branch.id.match(/(\d+)$/);
  if (idMatch) return `B${idMatch[1].padStart(2, "0")}`;

  const fromId = sanitizeBranchCode(branch.id);
  return fromId.length >= 2 ? fromId : "BR01";
}
