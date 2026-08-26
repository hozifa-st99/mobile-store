export type KpiVariant =
  | "sales"
  | "profit"
  | "loss"
  | "inventory"
  | "customers"
  | "invoices"
  | "purchases"
  | "expenses"
  | "maintenance"
  | "treasury";

export const kpiThemes: Record<
  KpiVariant,
  {
    bg: string;
    shadow: string;
    shine: string;
    titleColor: string;
    detailColor: string;
  }
> = {
  sales: {
    bg: "linear-gradient(148deg, #10b981 0%, #059669 42%, #047857 100%)",
    shadow: "0 18px 40px -12px rgba(16, 185, 129, 0.55)",
    shine: "rgba(255, 255, 255, 0.22)",
    titleColor: "#ecfdf5",
    detailColor: "#a7f3d0",
  },
  profit: {
    bg: "linear-gradient(148deg, #14b8a6 0%, #0d9488 42%, #0f766e 100%)",
    shadow: "0 18px 40px -12px rgba(20, 184, 166, 0.5)",
    shine: "rgba(255, 255, 255, 0.2)",
    titleColor: "#f0fdfa",
    detailColor: "#99f6e4",
  },
  loss: {
    bg: "linear-gradient(148deg, #f87171 0%, #ef4444 42%, #dc2626 100%)",
    shadow: "0 18px 40px -12px rgba(239, 68, 68, 0.5)",
    shine: "rgba(255, 255, 255, 0.2)",
    titleColor: "#fff1f2",
    detailColor: "#fecdd3",
  },
  inventory: {
    bg: "linear-gradient(148deg, #3b82f6 0%, #2563eb 42%, #1d4ed8 100%)",
    shadow: "0 18px 40px -12px rgba(59, 130, 246, 0.5)",
    shine: "rgba(255, 255, 255, 0.2)",
    titleColor: "#eff6ff",
    detailColor: "#bfdbfe",
  },
  customers: {
    bg: "linear-gradient(148deg, #fb923c 0%, #f97316 42%, #ea580c 100%)",
    shadow: "0 18px 40px -12px rgba(249, 115, 22, 0.5)",
    shine: "rgba(255, 255, 255, 0.2)",
    titleColor: "#fff7ed",
    detailColor: "#fed7aa",
  },
  invoices: {
    bg: "linear-gradient(148deg, #8b5cf6 0%, #7c3aed 42%, #6d28d9 100%)",
    shadow: "0 18px 40px -12px rgba(124, 58, 237, 0.5)",
    shine: "rgba(255, 255, 255, 0.2)",
    titleColor: "#f5f3ff",
    detailColor: "#ddd6fe",
  },
  purchases: {
    bg: "linear-gradient(148deg, #6366f1 0%, #4f46e5 42%, #4338ca 100%)",
    shadow: "0 18px 40px -12px rgba(99, 102, 241, 0.5)",
    shine: "rgba(255, 255, 255, 0.2)",
    titleColor: "#eef2ff",
    detailColor: "#c7d2fe",
  },
  expenses: {
    bg: "linear-gradient(148deg, #fbbf24 0%, #f59e0b 42%, #d97706 100%)",
    shadow: "0 18px 40px -12px rgba(245, 158, 11, 0.5)",
    shine: "rgba(255, 255, 255, 0.22)",
    titleColor: "#fffbeb",
    detailColor: "#fde68a",
  },
  maintenance: {
    bg: "linear-gradient(148deg, #22d3ee 0%, #06b6d4 42%, #0891b2 100%)",
    shadow: "0 18px 40px -12px rgba(6, 182, 212, 0.5)",
    shine: "rgba(255, 255, 255, 0.2)",
    titleColor: "#ecfeff",
    detailColor: "#a5f3fc",
  },
  treasury: {
    bg:
      "linear-gradient(155deg, rgba(0, 0, 0, 0.48) 0%, rgba(251, 191, 36, 0.07) 42%, rgba(0, 0, 0, 0.42) 100%)",
    shadow: "0 12px 28px -10px rgba(0, 0, 0, 0.45)",
    shine: "rgba(251, 191, 36, 0.08)",
    titleColor: "rgba(253, 230, 138, 0.92)",
    detailColor: "rgba(251, 191, 36, 0.78)",
  },
};
