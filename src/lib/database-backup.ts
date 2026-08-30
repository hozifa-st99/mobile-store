import "server-only";

import { spawn } from "child_process";
import { existsSync } from "fs";
import { access, constants } from "fs/promises";
import { join } from "path";

import {
  BACKUP_FILE_EXTENSION,
  BACKUP_FILE_PREFIX,
} from "@/lib/database-backup-constants";

const PG_BINARIES = ["pg_dump", "pg_restore"] as const;
type PgBinary = (typeof PG_BINARIES)[number];

export function getDatabaseConnectionUrl(): string {
  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("رابط قاعدة البيانات غير مُعرّف على السيرفر");
  }
  return url;
}

export function buildBackupFileName(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${BACKUP_FILE_PREFIX}${stamp}${BACKUP_FILE_EXTENSION}`;
}

export function isPgCustomBackupBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("utf8") === "PGDMP";
}

function resolvePgBinary(name: PgBinary): string {
  const fileName = process.platform === "win32" ? `${name}.exe` : name;

  if (process.platform === "win32") {
    for (const version of ["17", "16", "15", "14", "13", "12"]) {
      const candidate = join("C:\\Program Files\\PostgreSQL", version, "bin", fileName);
      if (existsSync(candidate)) return candidate;
    }
  }

  return fileName;
}

async function assertPgBinaryAvailable(name: PgBinary): Promise<string> {
  const binary = resolvePgBinary(name);
  try {
    await access(binary, constants.X_OK);
  } catch {
    if (binary === name || binary.endsWith(".exe")) {
      throw new Error(
        "أدوات PostgreSQL (pg_dump / pg_restore) غير متوفرة على السيرفر. ثبّت PostgreSQL client tools ثم أعد المحاولة."
      );
    }
  }
  return binary;
}

function runPgBinary(
  binary: PgBinary,
  args: string[],
  options?: { allowExitCodeOne?: boolean }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const command = resolvePgBinary(binary);
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `تعذر تشغيل ${binary}. تأكد من تثبيت PostgreSQL client tools على السيرفر. (${error.message})`
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0 || (options?.allowExitCodeOne && code === 1)) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `فشل تنفيذ ${binary} (رمز ${code ?? "?"})`));
    });
  });
}

export async function createDatabaseBackup(outputPath: string): Promise<void> {
  await assertPgBinaryAvailable("pg_dump");
  const connectionUrl = getDatabaseConnectionUrl();

  await runPgBinary("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--verbose",
    "--file",
    outputPath,
    connectionUrl,
  ]);
}

export async function restoreDatabaseBackup(inputPath: string): Promise<void> {
  await assertPgBinaryAvailable("pg_restore");
  const connectionUrl = getDatabaseConnectionUrl();

  await runPgBinary(
    "pg_restore",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      "--single-transaction",
      "--verbose",
      "--dbname",
      connectionUrl,
      inputPath,
    ],
    { allowExitCodeOne: true }
  );
}
