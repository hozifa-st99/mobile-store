export type VaultCashSource = "shift" | "vault";

export type BranchVaultMovementType =
  | "shift_deposit"
  | "open_shift_deposit"
  | "purchase_payment"
  | "purchase_debt_payment";

export const BRANCH_VAULT_TYPE_LABELS: Record<BranchVaultMovementType, string> = {
  shift_deposit: "توريد من وردية",
  open_shift_deposit: "توريد من وردية مفتوحة",
  purchase_payment: "دفع فاتورة مشتريات",
  purchase_debt_payment: "سداد أجل مشتريات",
};

export const BRANCH_VAULT_TYPE_FILTER_OPTIONS = (
  Object.entries(BRANCH_VAULT_TYPE_LABELS) as [BranchVaultMovementType, string][]
).map(([value, label]) => ({ value, label }));

export function parseBranchVaultMovementType(value: unknown): BranchVaultMovementType | null {
  if (
    value === "shift_deposit" ||
    value === "open_shift_deposit" ||
    value === "purchase_payment" ||
    value === "purchase_debt_payment"
  ) {
    return value;
  }
  return null;
}
