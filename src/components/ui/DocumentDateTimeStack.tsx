import { formatDocumentDate, formatDocumentTime } from "@/lib/document-datetime";

interface DocumentDateTimeStackProps {
  value: Date | string;
  className?: string;
}

export default function DocumentDateTimeStack({
  value,
  className = "",
}: DocumentDateTimeStackProps) {
  return (
    <div className={`leading-tight ${className}`.trim()}>
      <div className="text-sm text-muted">{formatDocumentDate(value)}</div>
      <div className="text-[11px] text-muted-dark tabular-nums mt-0.5">
        {formatDocumentTime(value)}
      </div>
    </div>
  );
}
