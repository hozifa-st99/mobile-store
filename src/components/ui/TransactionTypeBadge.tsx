import { transactionTypeBadgeClass } from "@/lib/transaction-type-badges";

interface TransactionTypeBadgeProps {
  type: string;
  label: string;
}

export default function TransactionTypeBadge({ type, label }: TransactionTypeBadgeProps) {
  const badge = transactionTypeBadgeClass(type);

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badge}`}
    >
      {label}
    </span>
  );
}
