"use client";

import Link from "next/link";

import { em } from "@/components/ui/TableEmoji";
import { useScreenAccess } from "@/hooks/use-screen-access";

/** انتقال لشاشة الديون والأجل الخارجية — عرض فقط، يظهر بصلاحية debts */
export default function ExternalDebtsNavButton() {
  const { canAccessPath } = useScreenAccess();

  if (!canAccessPath("/debts")) return null;

  return (
    <Link
      href="/debts"
      className="inline-flex max-w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-[11px] font-semibold leading-tight text-amber-200 transition-all hover:bg-amber-500/20 hover:text-white sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
    >
      <span className="shrink-0 text-sm leading-none sm:text-base" aria-hidden>
        {em.payment}
      </span>
      <span className="text-center">الديون والأجل الخارجي</span>
    </Link>
  );
}
