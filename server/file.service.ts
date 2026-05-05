"use server";

import { db } from "@bee/core/lib/db";
import { fileFolders, files } from "@bee/core/lib/db/schema";
import { generateId } from "@bee/core/lib/id-generator";
import { getPreSignedDownloadUrl } from "@bee/core/lib/s3";
import type { UploadedFile } from "@bee/core/lib/upload-router";
import { auth } from "@bee/core/modules/auth/auth.config";
import { getTenantIdOrThrow } from "@bee/core/lib/utils/tenant";
import { and, eq, isNull, sql } from "drizzle-orm";

function detectFileType(rawType: string) {
  const mimeToType: Record<string, string> = {
    "image/": "image",
    "video/": "video",
    "audio/": "audio",
    "application/pdf": "document",
    "application/zip": "archive",
    "application/x-rar-compressed": "archive",
    "application/x-7z-compressed": "archive",
  };

  let fileType = "other";
  for (const [mimePrefix, type] of Object.entries(mimeToType)) {
    if (rawType.startsWith(mimePrefix)) {
      fileType = type;
      break;
    }
  }

  return fileType;
}

const CATEGORY_DEFAULTS: Record<
  string,
  { name: string; icon: string; color: string }
> = {
  image: { name: "Images", icon: "image", color: "blue" },
  video: { name: "Videos", icon: "video", color: "purple" },
  audio: { name: "Audio", icon: "music", color: "yellow" },
  document: { name: "Documents", icon: "file-text", color: "green" },
  archive: { name: "Archives", icon: "archive", color: "orange" },
  other: { name: "Others", icon: "file", color: "gray" },
};

export async function saveFile(file: UploadedFile) {
  const session = await auth();
  const accountId = session?.user?.id;
  if (!accountId) {
    throw new Error("Unauthorized");
  }

  if (!file) {
    throw new Error("No file data provided");
  }

  // Verify path 是 `{tenant}/...` 開頭(防 caller 偽造 path)
  const tenant = getTenantIdOrThrow();
  if (!file.path.startsWith(`${tenant}/`)) {
    return Response.json({ error: "Invalid path tenant prefix" }, { status: 400 });
  }

  // SECURITY: server-side dangerous extension blocklist（client 驗證可被繞過）
  const DANGEROUS_EXTENSIONS = new Set([
    "exe", "scr", "bat", "cmd", "ps1", "vbs",
    "php", "phtml", "jsp", "asp", "aspx",
    "jar", "msi", "dll", "com",
  ]);
  const lowerExt = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (DANGEROUS_EXTENSIONS.has(lowerExt)) {
    throw new Error(`File extension .${lowerExt} is not allowed`);
  }

  // Dedup:同 hash 已存在(active)就直接返回,不重複入 row
  // (cell DB 單 tenant,不需要 tenant_id 條件)
  if (file.hash) {
    const existing = await db.query.files.findFirst({
      where: and(eq(files.hash, file.hash), isNull(files.deletedAt)),
    });
    if (existing) {
      return existing;
    }
  }

  const extension = file.name.split(".").pop() || "";
  const fileType = detectFileType(file.type);
  const categoryDefault = CATEGORY_DEFAULTS[fileType] || CATEGORY_DEFAULTS.other;

  const result = await db.transaction(async (tx) => {
    // Upsert folder(原 storage category)
    await tx
      .insert(fileFolders)
      .values({
        id: fileType,
        name: categoryDefault.name,
        icon: categoryDefault.icon,
        color: categoryDefault.color,
        fileCount: 1,
        size: file.size,
      })
      .onConflictDoUpdate({
        target: fileFolders.id,
        set: {
          fileCount: sql`${fileFolders.fileCount} + 1`,
          size: sql`${fileFolders.size} + ${file.size}`,
        },
      });

    const [fileRecord] = await tx
      .insert(files)
      .values({
        id: generateId(),
        name: file.name,
        size: file.size,
        type: fileType,
        extension,
        url: file.url || null,
        path: file.path,
        mimeType: file.type,
        metadata: {},
        ownerId: accountId,
        folderId: fileType,
        hash: file.hash,
        scanStatus: "clean",
      })
      .returning();

    return fileRecord;
  });

  return result;
}

/**
 * Soft-delete file(assets-foundation §6:hard delete 等 lifecycle 出手)
 */
export async function deleteFile(fileId: string) {
  const session = await auth();
  const accountId = session?.user?.id;
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [updated] = await db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(and(eq(files.id, fileId), eq(files.ownerId, accountId)))
    .returning();

  if (!updated) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
  return updated;
}

/**
 * Issue 5-min download URL for private files。
 * Gates by scanStatus = 'clean'(quarantined / pending 一律 reject)。
 */
export async function getDownloadUrl(fileId: string) {
  const session = await auth();
  const accountId = session?.user?.id;
  if (!accountId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await db.query.files.findFirst({
    where: and(
      eq(files.id, fileId),
      eq(files.ownerId, accountId),
      isNull(files.deletedAt)
    ),
  });
  if (!file) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  if (file.scanStatus !== "clean") {
    return Response.json(
      { error: `File scan status: ${file.scanStatus}` },
      { status: 403 },
    );
  }

  // Path 是 `{tenant}/{sha256}.{ext}`,getPreSignedDownloadUrl 用 raw key
  const url = await getPreSignedDownloadUrl(file.path, "private");
  return { url };
}
