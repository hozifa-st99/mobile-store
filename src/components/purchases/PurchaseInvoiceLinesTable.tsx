"use client";



import { formatCurrency, formatPriceAfterExpense } from "@/lib/utils";
import { LogoDisplay } from "@/components/ui/LogoUpload";

import type { InvoiceLineRow } from "@/lib/purchase-line-display";



const money = "text-base font-bold tabular-nums tracking-tight";



interface PurchaseInvoiceLinesTableProps {
  rows: InvoiceLineRow[];
  invoiceNumber?: string;
  heading?: string;
  caption?: string;
  hasExpenses?: boolean;
  readOnly?: boolean;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export default function PurchaseInvoiceLinesTable({
  rows,
  invoiceNumber,
  heading = "بنود الفاتورة",
  caption,
  hasExpenses = false,
  readOnly = false,
  onEdit,
  onRemove,
}: PurchaseInvoiceLinesTableProps) {

  if (rows.length === 0) return null;



  const totalBefore = rows.reduce((s, r) => s + r.total, 0);

  const totalAfter = rows.reduce(

    (s, r) => s + (hasExpenses && r.totalAfter != null ? r.totalAfter : r.total),

    0

  );

  const grandTotal = hasExpenses ? totalAfter : totalBefore;

  const colCount = hasExpenses ? (readOnly ? 11 : 12) : readOnly ? 9 : 10;



  const beforeHead =

    "px-3 py-3.5 text-xs font-bold text-slate-200 bg-slate-700/40 border-s border-white/10 whitespace-nowrap";

  const afterHead =

    "px-3 py-3.5 text-xs font-bold text-orange-100 bg-orange-900/30 border-s border-white/10 whitespace-nowrap";

  const beforeCell = `px-3 py-3.5 ${money} text-slate-600 bg-slate-50/80`;

  const afterCell = `px-3 py-3.5 ${money} text-orange-700 bg-orange-50/90`;

  const beforeTotalCell = `px-3 py-3.5 ${money} text-slate-700 bg-slate-100`;

  const afterTotalCell = `px-3 py-3.5 ${money} text-orange-800 bg-orange-100/80`;



  return (

    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">

      <div className="bg-gradient-to-l from-[#1e2a4a] via-[#243352] to-[#1a2540] px-5 py-4 border-b border-white/10">

        <div className="flex items-center justify-between gap-3 flex-wrap">

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="text-base font-bold text-white tracking-wide">{heading}</h3>

              {invoiceNumber && (

                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-xs font-semibold text-accent-green">

                  🧾 {invoiceNumber}

                </span>

              )}

            </div>

            <p className="text-xs text-white/50 mt-0.5">
              {caption || `${rows.length} صنف مضاف`}
            </p>

          </div>

          {hasExpenses ? (

            <div className="flex flex-wrap items-end gap-4 text-left">

              <div>
                <p className="text-[10px] text-slate-300/70">قبل إضافة المصروف</p>
                <p className="text-[11px] text-slate-300/80">إجمالي الشراء</p>
                <p className={`text-lg ${money} text-slate-200`}>{formatCurrency(totalBefore)} ج.م</p>
              </div>

              <div className="text-white/30 text-xl font-light pb-0.5">←</div>

              <div>
                <p className="text-[10px] text-orange-200/70">بعد إضافة المصروف</p>
                <p className="text-[11px] text-orange-200/90">إجمالي الشراء</p>
                <p className={`text-xl ${money} text-accent-orange`}>{formatCurrency(totalAfter)} ج.م</p>
              </div>

            </div>

          ) : (

            <div className="text-left">

              <p className="text-[11px] text-white/45">إجمالي الشراء</p>

              <p className={`text-xl ${money} text-accent-green`}>{formatCurrency(grandTotal)} ج.م</p>

            </div>

          )}

        </div>

      </div>



      <div className="overflow-x-auto bg-[#f8f9fc]">

        <table className={`w-full text-right ${hasExpenses ? "min-w-[1280px]" : "min-w-[960px]"}`}>

          <thead>

            <tr className="bg-gradient-to-l from-[#1a2540] via-[#243352] to-[#1e2a4a]">

              <th className="px-3 py-3.5 text-xs font-bold text-white">#</th>

              <th className="px-3 py-3.5 text-xs font-bold text-white">النوع</th>

              <th className="px-3 py-3.5 text-xs font-bold text-white">الصنف</th>

              <th className="px-3 py-3.5 text-xs font-bold text-white">التفاصيل</th>

              <th className="px-3 py-3.5 text-xs font-bold text-white">الحالة</th>

              <th className="px-3 py-3.5 text-xs font-bold text-white">الكمية</th>

              {hasExpenses ? (

                <>

                  <th className={beforeHead}>
                    <span className="block text-[10px] font-normal text-slate-300/70 mb-0.5">
                      قبل إضافة المصروف
                    </span>
                    سعر الشراء
                  </th>

                  <th className={afterHead}>
                    <span className="block text-[10px] font-normal text-orange-200/70 mb-0.5">
                      بعد إضافة المصروف
                    </span>
                    سعر الشراء
                  </th>

                </>

              ) : (

                <th className="px-3 py-3.5 text-xs font-bold text-white whitespace-nowrap">سعر الشراء</th>

              )}

              <th className="px-3 py-3.5 text-xs font-bold text-white whitespace-nowrap">سعر البيع</th>

              {hasExpenses ? (

                <>

                  <th className={beforeHead}>
                    <span className="block text-[10px] font-normal text-slate-300/70 mb-0.5">
                      قبل إضافة المصروف
                    </span>
                    إجمالي الشراء
                  </th>

                  <th className={afterHead}>
                    <span className="block text-[10px] font-normal text-orange-200/70 mb-0.5">
                      بعد إضافة المصروف
                    </span>
                    إجمالي الشراء
                  </th>

                </>

              ) : (

                <th className="px-3 py-3.5 text-xs font-bold text-white whitespace-nowrap">إجمالي الشراء</th>

              )}

              {!readOnly && (
              <th className="px-3 py-3.5 text-xs font-bold text-white">إجراءات</th>
              )}

            </tr>

          </thead>

          <tbody>

            {rows.map((row, idx) => {
              const purchaseCost = row.unitPriceAfter ?? row.unitPrice;
              const retailEqualsPurchase =
                row.retailPrice > 0 &&
                purchaseCost > 0 &&
                row.retailPrice === purchaseCost;
              const retailBelowPurchase =
                row.retailPrice > 0 &&
                purchaseCost > 0 &&
                row.retailPrice < purchaseCost;

              return (

              <tr

                key={row.id}

                className="border-t border-[#e2e8f0] text-[#1a202c] hover:bg-white transition-colors"

              >

                <td className="px-3 py-3.5 text-sm font-semibold text-[#718096]">{idx + 1}</td>

                <td className="px-3 py-3.5">

                  <span

                    className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${

                      row.type === "phone"

                        ? "bg-blue-100 text-blue-700"

                        : "bg-emerald-100 text-emerald-700"

                    }`}

                  >

                    {row.typeLabel}

                  </span>

                </td>

                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2.5 min-w-[140px]">
                    <LogoDisplay url={row.imageUrl} name={row.name} size="sm" />
                    <span className="font-semibold text-[#1a202c]">{row.name}</span>
                  </div>
                </td>

                <td className="px-3 py-3.5 text-[#4a5568] text-xs max-w-[200px]">{row.details}</td>

                <td className="px-3 py-3.5 text-xs">{row.condition}</td>

                <td className={`px-3 py-3.5 ${money} text-[#2d3748]`}>{row.quantity}</td>

                {hasExpenses ? (

                  <>

                    <td className={beforeCell}>{formatCurrency(row.unitPrice)}</td>

                    <td className={afterCell}>

                      {formatPriceAfterExpense(row.unitPriceAfter ?? row.unitPrice)}

                    </td>

                  </>

                ) : (

                  <td className={`px-3 py-3.5 ${money} text-[#2d3748]`}>

                    {formatCurrency(row.unitPrice)}

                  </td>

                )}

                <td
                  className={`px-3 py-3.5 ${money} ${
                    retailBelowPurchase
                      ? "text-red-700 bg-red-50 ring-1 ring-inset ring-red-200"
                      : retailEqualsPurchase
                        ? "text-amber-600 bg-amber-50 ring-1 ring-inset ring-amber-200"
                        : "text-emerald-700"
                  }`}
                  title={
                    retailBelowPurchase
                      ? "سعر البيع أقل من سعر الشراء بعد المصروف"
                      : retailEqualsPurchase
                        ? "سعر البيع يساوي سعر الشراء — لا يوجد ربح"
                        : undefined
                  }
                >
                  {formatCurrency(row.retailPrice)}
                  {retailBelowPurchase && (
                    <span className="block text-[10px] font-normal text-red-600 mt-0.5">
                      أقل من سعر الشراء
                    </span>
                  )}
                  {!retailBelowPurchase && retailEqualsPurchase && (
                    <span className="block text-[10px] font-normal text-amber-600 mt-0.5">
                      = سعر الشراء
                    </span>
                  )}
                </td>

                {hasExpenses ? (

                  <>

                    <td className={beforeTotalCell}>{formatCurrency(row.total)}</td>

                    <td className={afterTotalCell}>

                      {formatCurrency(row.totalAfter ?? row.total)}

                    </td>

                  </>

                ) : (

                  <td className={`px-3 py-3.5 ${money} text-[#1a202c]`}>

                    {formatCurrency(row.total)}

                  </td>

                )}

                {!readOnly && (
                <td className="px-3 py-3.5">

                  <div className="flex items-center gap-1">

                    <button

                      type="button"

                      onClick={() => onEdit?.(row.id)}

                      className="px-2 py-1 rounded-lg text-xs text-[#4a5568] hover:bg-[#e2e8f0]"

                    >

                      ✏️

                    </button>

                    <button

                      type="button"

                      onClick={() => onRemove?.(row.id)}

                      className="px-2 py-1 rounded-lg text-xs text-red-600 hover:bg-red-50"

                    >

                      🗑️

                    </button>

                  </div>

                </td>
                )}

              </tr>

            );
            })}

          </tbody>

          <tfoot>

            <tr className="border-t-2 border-[#cbd5e0]">

              <td

                colSpan={colCount - (hasExpenses ? (readOnly ? 2 : 3) : readOnly ? 1 : 2)}

                className="px-4 py-3.5 text-left text-sm font-bold text-[#2d3748] bg-[#eef1f7]"

              >

                {hasExpenses ? "مجموع الشراء" : "مجموع الشراء"}

              </td>

              {hasExpenses ? (

                <>

                  <td className={`${beforeTotalCell} border-t-2 border-slate-300`}>

                    {formatCurrency(totalBefore)} ج.م

                  </td>

                  <td className={`${afterTotalCell} border-t-2 border-orange-300`}>

                    {formatCurrency(totalAfter)} ج.م

                  </td>

                </>

              ) : (

                <td className={`px-3 py-3.5 ${money} text-[#1a202c] bg-[#eef1f7] border-t-2 border-[#cbd5e0]`}>

                  {formatCurrency(grandTotal)} ج.م

                </td>

              )}

              {!readOnly && <td className="bg-[#eef1f7] border-t-2 border-[#cbd5e0]" />}

            </tr>

          </tfoot>

        </table>

      </div>

    </div>

  );

}


