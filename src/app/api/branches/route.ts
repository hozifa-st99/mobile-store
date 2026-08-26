import { NextRequest, NextResponse } from "next/server";

import { requireUserManager } from "@/lib/api-auth";
import {
  branchHasActivity,
  formatBranchForClient,
  normalizeBranchCodeInput,
  validateBranchCode,
} from "@/lib/branch-service";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";

  const branches = await prisma.branch.findMany({
    where: {
      companyId: auth.companyId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { nameAr: "asc" }],
  });

  const rows = await Promise.all(
    branches.map(async (branch) => {
      const hasActivity = await branchHasActivity(prisma, branch.id);
      return {
        ...formatBranchForClient(branch),
        hasActivity,
        codeLocked: hasActivity,
      };
    })
  );

  return NextResponse.json({ branches: rows });
}

export async function POST(request: NextRequest) {
  const { auth, error } = await requireUserManager(request);
  if (error || !auth) return error;

  const body = await request.json();
  const nameAr = String(body.nameAr ?? "").trim();
  const codeRaw = String(body.code ?? "").trim();
  const address = body.address ? String(body.address).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!nameAr) {
    return NextResponse.json({ message: "اسم الفرع مطلوب" }, { status: 400 });
  }

  const codeError = validateBranchCode(codeRaw);
  if (codeError) {
    return NextResponse.json({ message: codeError }, { status: 400 });
  }

  const code = normalizeBranchCodeInput(codeRaw);

  try {
    const branch = await prisma.branch.create({
      data: {
        companyId: auth.companyId,
        nameAr,
        name: nameAr,
        code,
        address: address || null,
        phone: phone || null,
      },
    });

    return NextResponse.json(
      {
        branch: {
          ...formatBranchForClient(branch),
          hasActivity: false,
          codeLocked: false,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return NextResponse.json({ message: "كود الفرع مستخدم بالفعل" }, { status: 409 });
    }
    console.error("branch create:", e);
    return NextResponse.json({ message: "تعذر إضافة الفرع" }, { status: 500 });
  }
}
