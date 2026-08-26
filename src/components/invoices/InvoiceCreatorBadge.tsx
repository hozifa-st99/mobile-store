"use client";

import {
  creatorBadgeLabel,
  pickCreatorAvatarColor,
  type InvoiceCreatorInfo,
} from "@/lib/invoice-creator";

interface InvoiceCreatorBadgeProps {
  creator: InvoiceCreatorInfo | null | undefined;
  size?: "sm" | "md";
}

export default function InvoiceCreatorBadge({ creator, size = "md" }: InvoiceCreatorBadgeProps) {
  if (!creator?.username) return null;

  const dim = size === "sm" ? "w-7 h-7 text-[9px]" : "w-9 h-9 text-[10px]";
  const title = creator.fullNameAr
    ? `${creator.username} — ${creator.fullNameAr}`
    : creator.username;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/15 shadow-glow-sm ${dim}`}
      style={{ background: pickCreatorAvatarColor(creator.username) }}
      title={title}
    >
      {creatorBadgeLabel(creator.username)}
    </span>
  );
}

export function InvoiceNumberWithCreator({
  invoiceNumber,
  creator,
  emoji,
}: {
  invoiceNumber: string;
  creator: InvoiceCreatorInfo | null | undefined;
  emoji?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <InvoiceCreatorBadge creator={creator} size="sm" />
      <span className="inline-flex items-center gap-1.5 min-w-0">
        {emoji ? <span aria-hidden className="opacity-85 shrink-0">{emoji}</span> : null}
        <span className="truncate">{invoiceNumber}</span>
      </span>
    </span>
  );
}
