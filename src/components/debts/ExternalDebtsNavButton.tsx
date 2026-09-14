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
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 hover:text-white transition-all whitespace-nowrap"
    >
      <span aria-hidden>{em.payment}</span>
      الديون والأجل الخارجي
    </Link>
  );
}
