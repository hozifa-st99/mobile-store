"use client";

import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { em } from "@/components/ui/TableEmoji";
import { cn } from "@/lib/utils";

export type BranchComparisonSectionId =
  | "overview"
  | "comparison-table"
  | "sales"
  | "profits"
  | "purchases"
  | "inventory"
  | "turnover"
  | "products"
  | "product-cross"
  | "returns"
  | "expenses"
  | "stocktake"
  | "phones"
  | "kpi"
  | "performance-score"
  | "timeline";

export const BRANCH_COMPARISON_SECTIONS: {
  id: BranchComparisonSectionId;
  title: string;
  subtitle: string;
  emoji: string;
  accent: string;
}[] = [
  {
    id: "overview",
    title: "🏆 أفضل فرع",
    subtitle: "ملخص الأداء العام ودرجة التقييم",
    emoji: "🏆",
    accent: "from-amber-500/20 to-yellow-600/10 border-amber-400/30",
  },
  {
    id: "comparison-table",
    title: "📊 مقارنة شاملة",
    subtitle: "جدول المؤشرات بين جميع الفروع",
    emoji: "📊",
    accent: "from-indigo-500/20 to-violet-600/10 border-indigo-400/30",
  },
  {
    id: "sales",
    title: "📈 المبيعات",
    subtitle: "مبيعات الفروع ومقارنة الفترات",
    emoji: "📈",
    accent: "from-emerald-500/20 to-green-600/10 border-emerald-400/30",
  },
  {
    id: "profits",
    title: "💰 الأرباح",
    subtitle: "صافي الربح وهامش الربح لكل فرع",
    emoji: "💰",
    accent: "from-teal-500/20 to-cyan-600/10 border-teal-400/30",
  },
  {
    id: "purchases",
    title: "📦 المشتريات",
    subtitle: "مشتريات ومرتجعات المشتريات",
    emoji: "📦",
    accent: "from-blue-500/20 to-sky-600/10 border-blue-400/30",
  },
  {
    id: "inventory",
    title: "📦 أداء المخزون",
    subtitle: "قيمة المخزون والأصناف",
    emoji: em.product,
    accent: "from-purple-500/20 to-fuchsia-600/10 border-purple-400/30",
  },
  {
    id: "turnover",
    title: "🔄 دوران المخزون",
    subtitle: "معدل الدوران ومتوسط أيام البقاء",
    emoji: "🔄",
    accent: "from-orange-500/20 to-amber-600/10 border-orange-400/30",
  },
  {
    id: "products",
    title: "🏆 المنتجات",
    subtitle: "الأكثر مبيعًا وربحًا لكل فرع",
    emoji: "🏆",
    accent: "from-pink-500/20 to-rose-600/10 border-pink-400/30",
  },
  {
    id: "product-cross",
    title: "🔀 مقارنة المنتجات",
    subtitle: "نفس المنتج بين الفروع",
    emoji: "🔀",
    accent: "from-violet-500/20 to-purple-600/10 border-violet-400/30",
  },
  {
    id: "returns",
    title: "↩️ المرتجعات",
    subtitle: "مرتجعات المبيعات والمشتريات",
    emoji: "↩️",
    accent: "from-red-500/20 to-rose-600/10 border-red-400/30",
  },
  {
    id: "expenses",
    title: "💸 المصروفات",
    subtitle: "المصروفات كنسبة من المبيعات",
    emoji: "💸",
    accent: "from-yellow-500/20 to-orange-600/10 border-yellow-400/30",
  },
  {
    id: "stocktake",
    title: "📋 الجرد",
    subtitle: "فروق الجرد والـ IMEI المفقود",
    emoji: "📋",
    accent: "from-slate-500/20 to-gray-600/10 border-slate-400/30",
  },
  {
    id: "phones",
    title: "📱 الموبايلات",
    subtitle: "أداء الأجهزة والمخزون",
    emoji: "📱",
    accent: "from-cyan-500/20 to-blue-600/10 border-cyan-400/30",
  },
  {
    id: "kpi",
    title: "⚡ كفاءة الفرع",
    subtitle: "مؤشرات KPI التشغيلية",
    emoji: "⚡",
    accent: "from-lime-500/20 to-green-600/10 border-lime-400/30",
  },
  {
    id: "performance-score",
    title: "⭐ مؤشر الأداء",
    subtitle: "درجة الأداء العام ووزن المعايير",
    emoji: "⭐",
    accent: "from-amber-500/20 to-orange-600/10 border-amber-400/30",
  },
  {
    id: "timeline",
    title: "📅 التحليل الزمني",
    subtitle: "أداء الفروع عبر الزمن",
    emoji: "📅",
    accent: "from-indigo-500/20 to-blue-600/10 border-indigo-400/30",
  },
];

interface BranchComparisonReportsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BranchComparisonReportsModal({
  open,
  onClose,
}: BranchComparisonReportsModalProps) {
  const router = useRouter();

  const openSection = (sectionId: BranchComparisonSectionId) => {
    onClose();
    router.push(`/branch-comparison?section=${sectionId}`);
  };

  const openFull = () => {
    onClose();
    router.push("/branch-comparison");
  };

  return (
    <Modal open={open} onClose={onClose} title="🏆 مقارنة أداء الفروع" size="xl">
      <div className="space-y-4 pb-2">
        <p className="text-sm text-muted leading-relaxed">
          لوحة تحكم إدارية لمقارنة جميع فروع المحل — اختر القسم لعرض التفاصيل. البيانات من نفس
          منطق تقارير الفروع (عرض فقط).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRANCH_COMPARISON_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => openSection(section.id)}
              className={cn(
                "group text-right rounded-2xl border bg-gradient-to-br p-4 transition-all",
                "hover:scale-[1.02] hover:shadow-glow-sm active:scale-[0.99]",
                section.accent
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0" aria-hidden>
                  {section.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-white group-hover:text-primary-light transition-colors">
                    {section.title}
                  </p>
                  <p className="text-xs text-muted mt-1 leading-snug">{section.subtitle}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button type="button" onClick={openFull} className="btn-primary w-full mt-2">
          فتح لوحة المقارنة الكاملة
        </button>
      </div>
    </Modal>
  );
}
