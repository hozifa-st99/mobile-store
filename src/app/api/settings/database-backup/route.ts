import { mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { NextRequest, NextResponse } from "next/server";

import { requireSuperAdmin } from "@/lib/api-auth";
import {
  BACKUP_FILE_EXTENSION,
  buildBackupFileName,
  createDatabaseBackup,
  isPgCustomBackupBuffer,
  restoreDatabaseBackup,
} from "@/lib/database-backup";
import { RESTORE_CONFIRMATION_TEXT } from "@/lib/database-backup-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_RESTORE_BYTES = 512 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const tempDir = await mkdtemp(join(tmpdir(), "mobile-store-backup-"));
  const fileName = buildBackupFileName();
  const filePath = join(tempDir, fileName);

  try {
    await createDatabaseBackup(filePath);
    const info = await stat(filePath);
    if (info.size <= 0) {
      return NextResponse.json({ message: "فشل إنشاء النسخة الاحتياطية — الملف فارغ" }, { status: 500 });
    }

    const buffer = await readFile(filePath);
    if (!isPgCustomBackupBuffer(buffer)) {
      return NextResponse.json({ message: "ملف النسخة الاحتياطية غير صالح" }, { status: 500 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Backup-Size": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("database backup download:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذر إنشاء النسخة الاحتياطية" },
      { status: 500 }
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  let tempDir = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const confirmation = String(formData.get("confirmation") ?? "").trim();

    if (confirmation !== RESTORE_CONFIRMATION_TEXT) {
      return NextResponse.json(
        { message: `اكتب "${RESTORE_CONFIRMATION_TEXT}" للتأكيد قبل الاستعادة` },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "يجب اختيار ملف النسخة الاحتياطية" }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(BACKUP_FILE_EXTENSION)) {
      return NextResponse.json(
        { message: `الملف يجب أن يكون بصيغة ${BACKUP_FILE_EXTENSION}` },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ message: "الملف فارغ" }, { status: 400 });
    }

    if (file.size > MAX_RESTORE_BYTES) {
      return NextResponse.json(
        { message: "حجم الملف أكبر من الحد المسموح (512 ميجابايت)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isPgCustomBackupBuffer(buffer)) {
      return NextResponse.json(
        { message: "ملف النسخة الاحتياطية غير صالح — استخدم ملفاً تم تنزيله من هذه الشاشة" },
        { status: 400 }
      );
    }

    tempDir = await mkdtemp(join(tmpdir(), "mobile-store-restore-"));
    const restorePath = join(tempDir, file.name);
    await writeFile(restorePath, buffer);

    await restoreDatabaseBackup(restorePath);

    return NextResponse.json({
      message: "تمت استعادة قاعدة البيانات بنجاح. يُفضّل إعادة تحميل الصفحة.",
      restoredBytes: buffer.length,
    });
  } catch (err) {
    console.error("database backup restore:", err);
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "تعذرت استعادة النسخة الاحتياطية" },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
