"use client";

import { useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import { LogoDisplay } from "@/components/ui/LogoUpload";
import { ThEmoji, em } from "@/components/ui/TableEmoji";

export interface CatalogOverviewRow {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  subtitle?: React.ReactNode;
  meta?: string;
}

export interface CatalogOverviewGroup {
  id: string;
  title: string;
  logoUrl?: string | null;
  subtitle?: string;
  rows: CatalogOverviewRow[];
}

export interface CatalogOverviewSection {
  id: string;
  title: string;
  logoUrl?: string | null;
  subtitle?: string;
  groups: CatalogOverviewGroup[];
}

interface CatalogOverviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: CatalogOverviewSection[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

const COL_COUNT = 4;

function matchesQuery(text: string, query: string) {
  return text.toLowerCase().includes(query);
}

function filterSections(sections: CatalogOverviewSection[], query: string): CatalogOverviewSection[] {
  if (!query.trim()) return sections;

  const q = query.trim().toLowerCase();

  return sections
    .map((section) => {
      const sectionMatch =
        matchesQuery(section.title, q) || (section.subtitle && matchesQuery(section.subtitle, q));

      const groups = section.groups
        .map((group) => {
          const groupMatch =
            matchesQuery(group.title, q) || (group.subtitle && matchesQuery(group.subtitle, q));

          const rows = group.rows.filter(
            (row) =>
              matchesQuery(row.nameAr, q) ||
              (row.meta && matchesQuery(row.meta, q)) ||
              sectionMatch ||
              groupMatch
          );

          if (rows.length === 0 && !groupMatch && !sectionMatch) return null;
          return { ...group, rows: rows.length > 0 ? rows : group.rows };
        })
        .filter((g): g is CatalogOverviewGroup => g !== null);

      if (groups.length === 0 && !sectionMatch) return null;
      return { ...section, groups };
    })
    .filter((s): s is CatalogOverviewSection => s !== null);
}

function showGroupBand(section: CatalogOverviewSection, group: CatalogOverviewGroup) {
  return section.groups.length > 1 || group.title !== section.title;
}

export default function CatalogOverviewModal({
  open,
  onClose,
  title,
  sections,
  searchPlaceholder = "بحث في القائمة...",
  emptyMessage = "لا توجد بيانات للعرض",
}: CatalogOverviewModalProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => filterSections(sections, search), [sections, search]);

  const totalRows = useMemo(
    () => sections.reduce((sum, s) => sum + s.groups.reduce((gSum, g) => gSum + g.rows.length, 0), 0),
    [sections]
  );

  const visibleRows = useMemo(
    () => filtered.reduce((sum, s) => sum + s.groups.reduce((gSum, g) => gSum + g.rows.length, 0), 0),
    [filtered]
  );

  return (
    <Modal
      open={open}
      onClose={() => {
        setSearch("");
        onClose();
      }}
      title={title}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-sm text-muted">
            عرض شامل للقائمة —{" "}
            <strong className="text-white">
              {search.trim() ? `${visibleRows} من ${totalRows}` : totalRows}
            </strong>{" "}
            عنصر
          </p>
          <div className="relative sm:w-72">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-dark">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg py-2.5 pr-10 pl-3 text-sm text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#6339f9]/50 catalog-control"
            />
          </div>
        </div>

        <div className="catalog-overview-shell">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-dark text-sm">{emptyMessage}</div>
          ) : (
            <table className="catalog-overview-table">
              <thead>
                <tr>
                  <ThEmoji emoji={em.number} className="text-right w-11">
                    #
                  </ThEmoji>
                  <ThEmoji emoji={em.image} className="text-right w-20">
                    الصورة
                  </ThEmoji>
                  <ThEmoji emoji={em.name} className="text-right">
                    الاسم
                  </ThEmoji>
                  <ThEmoji emoji={em.date} className="text-right w-32">
                    تاريخ الإضافة
                  </ThEmoji>
                </tr>
              </thead>
              <tbody>
                {filtered.map((section) => {
                  const sectionCount = section.groups.reduce((s, g) => s + g.rows.length, 0);

                  return (
                    <SectionBlock
                      key={section.id}
                      section={section}
                      sectionCount={sectionCount}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-[11px] text-muted-dark text-center">
          عرض فقط — للتعديل استخدم الشاشة الرئيسية
        </p>
      </div>
    </Modal>
  );
}

function SectionBlock({
  section,
  sectionCount,
}: {
  section: CatalogOverviewSection;
  sectionCount: number;
}) {
  return (
    <>
      <tr className="catalog-overview-section-row">
        <td colSpan={COL_COUNT}>
          <div className="catalog-overview-section-band">
            <LogoDisplay url={section.logoUrl} name={section.title} size="sm" />
            <span className="catalog-overview-section-band__title">{section.title}</span>
            {section.subtitle && (
              <span className="catalog-overview-section-band__meta">{section.subtitle}</span>
            )}
            <span className="catalog-overview-section-band__meta">{sectionCount} عنصر</span>
          </div>
        </td>
      </tr>

      {section.groups.length === 0 ? (
        <tr className="catalog-overview-empty-row">
          <td colSpan={COL_COUNT}>لا توجد عناصر في هذه الفئة</td>
        </tr>
      ) : (
        section.groups.map((group) => (
          <GroupBlock key={group.id} section={section} group={group} />
        ))
      )}
    </>
  );
}

function GroupBlock({
  section,
  group,
}: {
  section: CatalogOverviewSection;
  group: CatalogOverviewGroup;
}) {
  const hasGroupBand = showGroupBand(section, group);

  if (group.rows.length === 0) {
    return (
      <>
        {hasGroupBand && <GroupBandRow group={group} />}
        <tr className="catalog-overview-empty-row">
          <td colSpan={COL_COUNT}>لا توجد عناصر تحت «{group.title}»</td>
        </tr>
      </>
    );
  }

  return (
    <>
      {hasGroupBand && <GroupBandRow group={group} />}
      {group.rows.map((row, index) => (
        <tr
          key={row.id}
          className={`catalog-overview-item-row${hasGroupBand ? " catalog-overview-item-row--nested" : ""}`}
        >
          <td>{index + 1}</td>
          <td>
            <LogoDisplay url={row.logoUrl} name={row.nameAr} size="sm" />
          </td>
          <td>
            <p className="text-sm font-semibold text-white">{row.nameAr}</p>
            {row.subtitle ? <div className="mt-1">{row.subtitle}</div> : null}
          </td>
          <td className="text-[#94a3b8] text-xs">{row.meta || "—"}</td>
        </tr>
      ))}
    </>
  );
}

function GroupBandRow({ group }: { group: CatalogOverviewGroup }) {
  return (
    <tr className="catalog-overview-group-row">
      <td colSpan={COL_COUNT}>
        <div className="catalog-overview-group-band">
          <span className="catalog-overview-group-band__accent" aria-hidden />
          <LogoDisplay url={group.logoUrl} name={group.title} size="xs" />
          <span className="catalog-overview-group-band__title">{group.title}</span>
          {group.subtitle && (
            <span className="catalog-overview-group-band__meta">{group.subtitle}</span>
          )}
        </div>
      </td>
    </tr>
  );
}
