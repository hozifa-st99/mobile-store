import { NextRequest, NextResponse } from "next/server";

import { getCompanyScopedAuthFromRequest, unauthorizedResponse } from "@/lib/api-auth";
import {
  PURCHASE_RETURN_EXPENSE_CATEGORY_KEY,
  type ExpenseCategoryItem,
  normalizeExpenseCategories,
} from "@/lib/expense-categories";
import {
  countExpensesUsingCategory,
  loadExpenseCategories,
  saveExpenseCategories,
} from "@/lib/expense-categories-server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const categories = await loadExpenseCategories(prisma, auth.companyId);
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("expense-categories GET:", error);
    return NextResponse.json({ message: "تعذر تحميل قائمة المصروفات" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getCompanyScopedAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "replace";

    if (action === "replace" && Array.isArray(body.categories)) {
      const categories = normalizeExpenseCategories(body.categories);
      if (categories.length === 0) {
        return NextResponse.json({ message: "يجب وجود تصنيف واحد على الأقل" }, { status: 400 });
      }
      const saved = await saveExpenseCategories(auth.companyId, categories);
      return NextResponse.json({ categories: saved });
    }

    const current = await loadExpenseCategories(prisma, auth.companyId);
    let next: ExpenseCategoryItem[] = [...current];

    if (action === "create") {
      const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
      if (!nameAr) {
        return NextResponse.json({ message: "اسم التصنيف مطلوب" }, { status: 400 });
      }
      const keys = new Set(next.map((c) => c.key));
      let key = `cat_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      while (keys.has(key)) {
        key = `cat_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
      }
      next.push({ key, nameAr, sortOrder: next.length + 1 });
    } else if (action === "update") {
      const key = typeof body.key === "string" ? body.key.trim() : "";
      const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
      if (!key || !nameAr) {
        return NextResponse.json({ message: "بيانات التصنيف غير مكتملة" }, { status: 400 });
      }
      const target = next.find((c) => c.key === key);
      if (!target) {
        return NextResponse.json({ message: "التصنيف غير موجود" }, { status: 404 });
      }
      if (target.isSystem && target.key === PURCHASE_RETURN_EXPENSE_CATEGORY_KEY && nameAr !== target.nameAr) {
        return NextResponse.json(
          { message: "لا يمكن تعديل اسم تصنيف مرتبط بمرتجعات المشتريات" },
          { status: 400 }
        );
      }
      next = next.map((c) => (c.key === key ? { ...c, nameAr } : c));
    } else if (action === "delete") {
      const key = typeof body.key === "string" ? body.key.trim() : "";
      if (!key) {
        return NextResponse.json({ message: "حدد التصنيف للحذف" }, { status: 400 });
      }
      const target = next.find((c) => c.key === key);
      if (!target) {
        return NextResponse.json({ message: "التصنيف غير موجود" }, { status: 404 });
      }
      if (target.isSystem) {
        return NextResponse.json({ message: "لا يمكن حذف تصنيف النظام" }, { status: 400 });
      }
      const used = await countExpensesUsingCategory(auth.companyId, key);
      if (used > 0) {
        return NextResponse.json(
          { message: `لا يمكن الحذف — يوجد ${used} مصروف مسجّل بهذا التصنيف` },
          { status: 400 }
        );
      }
      next = next.filter((c) => c.key !== key);
    } else if (action === "reorder" && Array.isArray(body.order)) {
      const order = body.order.filter((k: unknown) => typeof k === "string") as string[];
      const byKey = new Map(next.map((c) => [c.key, c] as const));
      next = order
        .map((key, index) => {
          const item = byKey.get(key);
          return item ? { ...item, sortOrder: index + 1 } : null;
        })
        .filter(Boolean) as ExpenseCategoryItem[];
      for (const item of byKey.values()) {
        if (!order.includes(item.key)) next.push(item);
      }
    } else {
      return NextResponse.json({ message: "طلب غير معروف" }, { status: 400 });
    }

    const saved = await saveExpenseCategories(auth.companyId, normalizeExpenseCategories(next));
    return NextResponse.json({ categories: saved });
  } catch (error) {
    console.error("expense-categories PUT:", error);
    return NextResponse.json({ message: "تعذر حفظ قائمة المصروفات" }, { status: 500 });
  }
}