"use client";

import { useState } from "react";
import { Eye, Landmark } from "lucide-react";

import KpiCard from "@/components/dashboard/KpiCard";
import OpenShiftDepositModal from "@/components/treasury/OpenShiftDepositModal";
import { formatAmountExact } from "@/lib/utils";

interface ActualCashTreasuryCardProps {
  value: number;
  branchVaultBalance?: number;
  subtitle?: string;
  delay?: number;
  onDepositSuccess?: () => void;
}

export default function ActualCashTreasuryCard({
  value,
  branchVaultBalance = 0,
  subtitle = "الوردية الحالية",
  delay = 400,
  onDepositSuccess,
}: ActualCashTreasuryCardProps) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [vaultRevealed, setVaultRevealed] = useState(false);

  return (
    <>
      <div className="actual-cash-treasury-row">
        <div
          className={`actual-cash-treasury-vault${vaultRevealed ? " actual-cash-treasury-vault--revealed" : ""}`}
        >
          <span className="actual-cash-treasury-vault__glow" aria-hidden />
          <span className="actual-cash-treasury-vault__ring" aria-hidden />
          <span className="actual-cash-treasury-vault__gloss" aria-hidden />

          <button
            type="button"
            className="actual-cash-treasury-vault__peek"
            onClick={() => setVaultRevealed((prev) => !prev)}
            aria-label={vaultRevealed ? "إخفاء رصيد خزنة الفرع" : "عرض رصيد خزنة الفرع"}
            aria-pressed={vaultRevealed}
          >
            <Eye className="w-4 h-4" strokeWidth={2.25} />
          </button>

          <div className="actual-cash-treasury-vault__balance" aria-hidden={!vaultRevealed}>
            <span className="actual-cash-treasury-vault__balance-value tabular-nums">
              {formatAmountExact(branchVaultBalance)}
            </span>
            <span className="actual-cash-treasury-vault__balance-suffix">ج.م</span>
          </div>

          <div className="actual-cash-treasury-vault__stage">
            <div className="actual-cash-treasury-vault__content">
              <span className="actual-cash-treasury-vault__icon">🏦</span>
              <span className="actual-cash-treasury-vault__label">الخزنة</span>
            </div>
          </div>
        </div>

        <div className="actual-cash-treasury-kpi-wrap">
          <button
            type="button"
            className="actual-cash-treasury-kpi__deposit"
            onClick={() => setDepositOpen(true)}
            aria-label="توريد نقدية للخزنة"
            title="توريد نقدية للخزنة"
          >
            <Landmark className="w-4 h-4" strokeWidth={2.25} />
          </button>

          <KpiCard
            className="actual-cash-treasury-kpi"
            variant="treasury"
            delay={delay}
            title="النقدي الفعلي"
            value={value}
            suffix="ج.م"
            subtitle={subtitle}
          />
        </div>
      </div>

      <OpenShiftDepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onSuccess={onDepositSuccess}
      />
    </>
  );
}
