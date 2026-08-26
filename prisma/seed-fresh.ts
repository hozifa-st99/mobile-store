/**

 * بذرة فارغة — بداية واقعية: شركة + فرع رئيسي + حسابات إدارة فقط

 */

import { PrismaClient } from "@prisma/client";

import bcrypt from "bcryptjs";



const prisma = new PrismaClient();



async function main() {

  const passwordHash = await bcrypt.hash("123456", 12);

  const superAdminPasswordHash = await bcrypt.hash("0000mobile0000", 12);



  const company = await prisma.company.create({

    data: {

      id: "company-1",

      name: "Company",

      nameAr: "شركتي",

      siteActivatedUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),

    },

  });



  const mainBranch = await prisma.branch.create({

    data: {

      id: "branch-1",

      companyId: company.id,

      code: "MAIN",

      name: "Main Branch",

      nameAr: "الفرع الرئيسي",

    },

  });



  const superAdmin = await prisma.user.create({

    data: {

      companyId: company.id,

      username: "superadmin",

      passwordHash: superAdminPasswordHash,

      fullName: "Super Admin",

      fullNameAr: "السوبر أدمن",

      role: "super_admin",

      isHidden: true,

    },

  });



  const admin = await prisma.user.create({

    data: {

      companyId: company.id,

      username: "admin",

      passwordHash,

      fullName: "System Admin",

      fullNameAr: "مدير النظام",

      role: "admin",

    },

  });



  for (const user of [superAdmin, admin]) {

    await prisma.userBranch.create({

      data: {

        userId: user.id,

        branchId: mainBranch.id,

        isDefault: true,

      },

    });

  }



  console.log("✅ Fresh seed completed — بداية واقعية (شركة + فرع رئيسي + حسابات إدارة فقط)");

  console.log("   superadmin / 0000mobile0000 — تفعيل الموقع (مخفي)");

  console.log("   admin / 123456 — مدير النظام (غيّر كلمة المرور من الإعدادات → المستخدمين)");

}



main()

  .catch(console.error)

  .finally(() => prisma.$disconnect());


