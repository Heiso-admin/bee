"use server";

import { db } from "@heiso-io/bee/lib/db";
import { members } from "@heiso-io/bee/lib/db/schema";
import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
/**
 * 取得當前帳號的成員資格
 * 統一使用 members 表
 */
async function getMembership() {
  const session = await auth();
  const memberId = session?.user?.id;

  if (!memberId) {
    throw new Error("Unauthorized");
  }

  const isDev = session.user.kind === "dev";

  if (isDev) {
    return { kind: "dev" as const, membership: null };
  }

  const member = await db.query.members.findFirst({
    columns: {
      id: true,
      role: true,
      roleId: true,
    },
    with: {
      customRole: {
        columns: {
          id: true,
        },
      },
    },
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), eq(t.status, "active"), isNull(t.deletedAt)),
  });

  return {
    kind: "member" as const,
    membership: member
      ? { id: member.id, role: member.role, customRole: member.customRole }
      : null,
  };
}

/**
 * 透過邀請 token 取得邀請資訊
 * 統一使用 members 表
 */
async function getInviteToken({ token }: { token: string }) {

  const member = await db.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.inviteToken, token), isNull(t.deletedAt)),
  });

  if (!member) return null;

  if (!member.inviteExpiredAt || member.inviteExpiredAt < new Date()) {
    return null;
  }

  return {
    id: member.id,
    memberId: member.id,
    inviteToken: member.inviteToken,
    inviteExpiredAt: member.inviteExpiredAt,
    status: member.status,
    profile: {
      name: member.name,
      email: member.email,
    },
  };
}

/**
 * 加入團隊
 * 統一使用 members 表
 */
async function join(memberId: string) {

  const result = await db
    .update(members)
    .set({
      inviteToken: null,
      inviteExpiredAt: null,
      status: "active",
      joinedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(members.id, memberId), isNull(members.deletedAt)));

  return result;
}

/**
 * 拒絕邀請
 * 統一使用 members 表
 */
async function decline(id: string) {

  return await db
    .update(members)
    .set({
      inviteToken: null,
      inviteExpiredAt: null,
      status: "suspended",
      updatedAt: new Date(),
    })
    .where(eq(members.id, id));
}

async function removeJoinToken() {
  const cookieStore = await cookies();
  cookieStore.delete("join-token");
}

export { getMembership, getInviteToken, join, decline, removeJoinToken };

/**
 * 更新使用者基本資料（名稱、頭像、密碼）
 * 統一使用 members 表
 */
export async function updateBasicProfile({
  memberId,
  name,
  avatar,
  password,
}: {
  memberId: string;
  name?: string;
  avatar?: string | null;
  password?: string;
}) {
  const session = await auth();
  if (!session?.user?.id || session.user.id !== memberId) {
    throw new Error("Unauthorized");
  }


  const updates: Record<string, any> = { updatedAt: new Date() };

  if (name !== undefined) updates.name = name;
  if (avatar !== undefined) updates.avatar = avatar;

  if (typeof password === "string" && password.trim().length > 0) {
    const { hashPassword } = await import("@heiso-io/bee/lib/hash");
    updates.password = await hashPassword(password.trim());
  }

  await db.update(members).set(updates).where(eq(members.id, memberId));

  return { ok: true };
}
