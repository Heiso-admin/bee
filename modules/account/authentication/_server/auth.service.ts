"use server";

import { db } from "@heiso-io/bee/lib/db";
import { z } from "zod";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * 更新密碼
 * 注意：密碼儲存在 cell DB，此功能需要 cell DB 支援
 */
export async function updatePassword(memberId: string, data: unknown) {
  const result = passwordSchema.safeParse(data);
  if (!result.success) {
    throw new Error("Invalid password format");
  }

  // TODO: 呼叫 cell DB 更新密碼
  // 密碼現在儲存在 cell DB 的 members 表
  // 需要實作 cell DB: POST /api/platform/members/:memberId/update-password
  console.warn("[updatePassword] Password update requires cell DB implementation");

  throw new Error("Password update requires cell DB implementation");
}

/**
 * 切換 2FA
 * 注意：2FA 設定儲存在 cell DB，此功能需要 cell DB 支援
 */
export async function toggle2FA(memberId: string, enabled: boolean) {
  // TODO: 呼叫 cell DB 更新 2FA 設定
  // 2FA 設定現在儲存在 cell DB 的 members 表
  console.warn("[toggle2FA] 2FA toggle requires cell DB implementation");

  throw new Error("2FA toggle requires cell DB implementation");
}

/**
 * 透過 memberId 查詢成員資格（含角色）
 * 統一使用 members 表
 */
export async function findMembershipByAccountId(memberId: string) {

  const member = await db.query.members.findFirst({
    columns: {
      id: true,
      status: true,
      role: true,
      roleId: true,
    },
    with: {
      customRole: {
        columns: { id: true, name: true }
      }
    },
    where: (t, { and, eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });

  if (!member) return null;

  return {
    id: member.id,
    memberId: member.id,
    status: member.status,
    role: member.role,
    customRole: member.customRole,
  };
}

