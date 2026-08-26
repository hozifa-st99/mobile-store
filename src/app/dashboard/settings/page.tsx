"use client";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { em } from "@/components/ui/TableEmoji";
import { useScreenAccess } from "@/hooks/use-screen-access";

const settingsSections = [
  {
    title: "قائمة الموبايلات",
    desc: "إدارة أنواع الأجهزة (iPhone / Android) والشركات وأسماء الموبايلات",
    href: "/dashboard/settings/phone-catalog",
    emoji: em.device,
    color: "#7c3aed",
  },
  {
    title: "قائمة الأصناف",
    desc: "إدارة أصناف المنتجات (سماعات، ساعات…) والعلامات التجارية وشعاراتها",
    href: "/dashboard/settings/item-catalog",
    emoji: "🏷️",
    color: "#14b8a6",
  },
  {
    title: "الموردين",
    desc: "إضافة وإدارة موردي البضاعة",
    href: "/dashboard/settings/suppliers",
    emoji: em.supplier,
    color: "#3b82f6",
  },
  {
    title: "الفروع",
    desc: "إضافة وتعديل فروع المحل — مخزون وفواتير منفصلة لكل فرع",
    href: "/dashboard/settings/branches",
    emoji: em.branch,
    color: "#6366f1",
  },
  {
    title: "المستخدمين",
    desc: "إدارة حسابات الموظفين والصلاحيات",
    href: "/dashboard/settings/users",
    emoji: em.customers,
    color: "#10b981",
  },
  {
    title: "التنبيهات",
    desc: "إعدادات تنبيهات المخزون والأقساط",
    href: "/dashboard/settings/notifications",
    emoji: em.bell,
    color: "#f59e0b",
  },
];

const printSettingsSection = {
  title: "إعدادات الطباعة",
  desc: "مقاس الورق وشكل فاتورة المبيعات والمعاينة",
  href: "/dashboard/settings/print",
  emoji: "🖨️",
  color: "#0ea5e9",
};

export default function SettingsPage() {
  const { isSuperAdmin } = useScreenAccess();

  const sections = [
    ...settingsSections,
    ...(isSuperAdmin
      ? [
          {
            title: "تفعيل الموقع",
            desc: "تفعيل أو إيقاف الموقع لمدة محددة — للسوبر أدمن فقط",
            href: "/dashboard/settings/site-activation",
            emoji: "🔐",
            color: "#ef4444",
          },
        ]
      : []),
    printSettingsSection,
  ];

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="إعدادات النظام والقوائم المرجعية" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <div className="glass-card p-5 hover:border-primary/30 hover:shadow-card-hover transition-all cursor-pointer group">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl"
                style={{ backgroundColor: `${section.color}20` }}
              >
                {section.emoji}
              </div>
              <h3 className="section-title group-hover:text-primary-light transition-colors">
                {section.title}
              </h3>
              <p className="text-sm text-muted mt-1">{section.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
