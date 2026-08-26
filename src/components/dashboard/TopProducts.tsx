"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useDashboard } from "./DashboardProvider";

export default function TopProducts() {
  const { topProducts: products } = useDashboard();

  return (
    <div className="glass-card p-5 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="section-title">أفضل المنتجات مبيعًا</h2>
        <Link
          href="/dashboard/products"
          className="text-xs font-medium text-primary-light hover:text-white px-3 py-1.5 rounded-lg border border-primary/30 hover:bg-primary/10 transition-all"
        >
          عرض الكل
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">لا توجد مبيعات بعد</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {products.map((product, i) => (
            <div
              key={`${product.name}-${i}`}
              className="rounded-xl p-3 bg-background-input/60 border border-border hover:border-primary/35 transition-all"
            >
              <div className="relative mb-3">
                <div className="w-full aspect-square rounded-xl bg-background-card flex items-center justify-center text-4xl overflow-hidden">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    "📱"
                  )}
                </div>
                {i === 0 && <span className="badge-best">الأكثر مبيعًا</span>}
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-[10px] text-muted border border-border">
                  {product.quantity} مبيع
                </span>
              </div>
              <h3 className="text-xs font-semibold text-white truncate">{product.name}</h3>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-xs font-bold text-white">
                  {formatCurrency(product.revenue)}{" "}
                  <span className="text-muted-dark font-normal">ج.م</span>
                </span>
                <Link
                  href="/dashboard/sales/new"
                  className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-sm hover:bg-primary hover:text-white transition-all"
                >
                  🛒
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
