"use server";

import { settings } from "@heiso-io/bee/config/settings";
import { db } from "@heiso-io/bee/lib/db";
import { members } from "@heiso-io/bee/lib/db/schema";
import { sendApprovedEmail, sendInviteUserEmail } from "@heiso-io/bee/lib/email";
import { generateInviteToken } from "@heiso-io/bee/lib/id-generator";
import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { MemberStatus, type Member } from "../types";

/**
 * 取得團隊所有成員
 * 使用 members 表
 */
async function getTeamMembers(): Promise<Member[]> {

  // 統一從 members 表取得成員資格
  const accountList = await db.query.members.findMany({
    with: {
      customRole: true,
    },
    where: (t, { isNull }) => isNull(t.deletedAt),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  return accountList.map(member => ({
    id: member.id,
    memberId: member.id,
    roleId: member.roleId,
    role: member.role as any,
    status: member.status as any,
    inviteToken: member.inviteToken,
    inviteExpiredAt: member.inviteExpiredAt,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    deletedAt: member.deletedAt,
    profile: {
      id: member.id,
      email: member.email,
      name: member.name,
      avatar: member.avatar,
      active: member.active,
      lastLoginAt: member.lastLoginAt,
    } as any,
    // @ts-ignore - customRole 與 role 名稱衝突
    customRole: member.customRole ?? null,
  })) as Member[];
}

/**
 * 邀請新成員
 * 統一使用 members 表
 */
async function invite({
  email,
  name,
  roleId,
  memberId: providedAccountId,
}: {
  email?: string;
  name?: string;
  roleId?: string | null;
  memberId?: string;
}) {
  const inviteToken = generateInviteToken();
  const inviteExpiredAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  if (!email && !providedAccountId) {
    throw new Error("EMAIL_OR_ACCOUNT_ID_REQUIRED");
  }

  // 如果提供了 memberId，使用它；否則用 email 查找
  let memberId = providedAccountId;
  if (!memberId && email) {
    const existingAccount = await db.query.members.findFirst({
      where: (t, { eq }) => eq(t.email, email),
    });
    memberId = existingAccount?.id;
  }

  if (memberId) {
    // 已存在的帳號
    const existingAccount = await db.query.members.findFirst({
      where: (t, { eq }) => eq(t.id, memberId as string),
    });

    if (existingAccount) {
      if (existingAccount.deletedAt) {
        // 如果曾被刪除，則恢復
        await db
          .update(members)
          .set({
            status: MemberStatus.Invited,
            roleId: roleId ?? null,
            inviteToken,
            inviteExpiredAt,
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(members.id, existingAccount.id));
      } else if (existingAccount.status === MemberStatus.Suspended) {
        // 如果曾被停用，則恢復為邀請狀態
        await db
          .update(members)
          .set({
            status: MemberStatus.Invited,
            roleId: roleId ?? null,
            inviteToken,
            inviteExpiredAt,
            updatedAt: new Date(),
          })
          .where(eq(members.id, existingAccount.id));
      } else {
        throw new Error("MEMBER_EXISTS");
      }

      if (email) {
        await sendInvite({ email, inviteToken, isOwner: false });
      }
      revalidateTag(`membership:${existingAccount.id}`, "default");
      revalidatePath("/portal/account/team", "page");
      return existingAccount;
    }
  }

  // 建立新帳號（僅 Core 模式支援直接建立）
  if (!email) throw new Error("EMAIL_REQUIRED");

  const { hashPassword } = await import("@heiso-io/bee/lib/hash");
  const { generateId } = await import("@heiso-io/bee/lib/id-generator");
  const randomPassword = await hashPassword(generateId(undefined, 32));

  const [created] = await db
    .insert(members)
    .values({
      email,
      name: name ?? email.split("@")[0],
      password: randomPassword,
      role: "member",
      roleId: roleId ?? null,
      status: MemberStatus.Invited,
      inviteToken,
      inviteExpiredAt,
      active: false,
    })
    .returning();

  await sendInvite({ email, inviteToken, isOwner: false });
  revalidateTag(`membership:${created.id}`, "default");
  revalidatePath("/portal/account/team", "page");
  return created;
}

/**
 * 更新成員資料
 * 統一使用 members 表
 */
async function updateMember({
  id,
  data,
}: {
  id: string;
  data: {
    role?: 'owner' | 'member';
    roleId?: string | null;
    status?: 'invited' | 'active' | 'inactive' | 'suspended';
  };
}) {

  const memberUpdates: Partial<typeof members.$inferInsert> = {
    ...data,
    updatedAt: new Date(),
  };

  const result = await db
    .update(members)
    .set(memberUpdates)
    .where(eq(members.id, id));

  revalidateTag(`membership:${id}`, "default");
  revalidatePath("/portal/account/team", "page");
  return result;
}

/**
 * 發送邀請 email
 */
async function sendInvite({
  email,
  inviteToken,
  isOwner,
}: {
  email: string;
  inviteToken: string;
  isOwner: boolean;
}) {
  const { NOTIFY_EMAIL } = await settings();
  const result = await sendInviteUserEmail({
    from: NOTIFY_EMAIL as string,
    to: [email],
    inviteToken,
    owner: isOwner,
  });
  return result;
}

/**
 * 發送核准通知 email
 */
async function sendApproved({ email }: { email: string }) {
  const { NOTIFY_EMAIL } = await settings();
  const result = await sendApprovedEmail({
    from: NOTIFY_EMAIL as string,
    to: [email],
  });
  return result;
}

/**
 * 重寄邀請
 * 統一使用 members 表
 */
async function resendInvite(id: string) {
  const inviteToken = generateInviteToken();
  const inviteExpiredAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const member = await db.query.members.findFirst({
    where: (t, { eq, isNull }) => and(eq(t.id, id), isNull(t.deletedAt)),
  });

  if (!member?.email) {
    throw new Error("Account not found");
  }

  await db
    .update(members)
    .set({
      inviteToken,
      inviteExpiredAt,
      updatedAt: new Date(),
    })
    .where(eq(members.id, id));

  const result = await sendInvite({
    email: member.email,
    inviteToken,
    isOwner: member.role === 'owner',
  });

  revalidatePath("/portal/account/team", "page");
  return result;
}

/**
 * 撤銷邀請
 * 統一使用 members 表（軟刪除）
 */
async function revokeInvite(id: string) {

  await db
    .update(members)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(members.id, id));

  revalidateTag(`membership:${id}`, "default");
  revalidatePath("/portal/account/team", "page");
}

/**
 * 離開團隊
 * 統一使用 members 表（軟刪除）
 */
async function leaveTeam(id: string) {

  await db
    .update(members)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(members.id, id));

  revalidateTag(`membership:${id}`, "default");
  revalidatePath("/portal/account/team", "page");
}

/**
 * 新增成員（直接啟用，不需要邀請流程）
 * 統一使用 members 表
 */
async function addMember({
  email,
  roleId,
  initialPassword,
}: {
  email: string;
  roleId: string;
  initialPassword?: string;
}) {
  const { hashPassword } = await import("@heiso-io/bee/lib/hash");

  const existingAccount = await db.query.members.findFirst({
    where: (t, { eq }) => eq(t.email, email),
  });

  if (existingAccount && !existingAccount.deletedAt) {
    throw new Error("Member already exists");
  }

  if (!initialPassword) {
    throw new Error("Initial password is required");
  }

  const hashedPassword = await hashPassword(initialPassword);
  const displayName = email.split("@")[0];

  if (existingAccount) {
    // 恢復已刪除的帳號
    const [updated] = await db
      .update(members)
      .set({
        password: hashedPassword,
        roleId,
        role: "member",
        status: "active",
        active: true,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, existingAccount.id))
      .returning();

    revalidateTag(`membership:${existingAccount.id}`, "default");
    revalidatePath("/portal/account/team", "page");
    return { member: updated };
  }

  const [newMember] = await db
    .insert(members)
    .values({
      email,
      name: displayName,
      password: hashedPassword,
      roleId,
      role: "member",
      status: "active",
      active: true,
    })
    .returning();

  revalidateTag(`membership:${newMember.id}`, "default");
  revalidatePath("/portal/account/team", "page");
  return { member: newMember };
}

/**
 * 轉移擁有權
 * 統一使用 members 表
 */
async function transferOwnership({
  newOwnerId,
  currentOwnerId,
}: {
  newOwnerId: string;
  currentOwnerId: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // 查找當前擁有者
  const currentOwnerAccount = await db.query.members.findFirst({
    where: (t, { eq, and }) =>
      and(
        eq(t.id, currentOwnerId),
        eq(t.id, session.user.id!),
        eq(t.role, 'owner'),
      ),
  });

  if (!currentOwnerAccount) {
    throw new Error("Only current owner can transfer ownership");
  }

  // 查找新擁有者
  const newOwnerAccount = await db.query.members.findFirst({
    where: (t, { eq, and }) =>
      and(eq(t.id, newOwnerId), eq(t.status, "active")),
  });

  if (!newOwnerAccount) {
    throw new Error("Target account must be active");
  }

  await db.transaction(async (tx) => {
    // 設定新擁有者
    await tx
      .update(members)
      .set({
        role: 'owner',
        roleId: null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, newOwnerId));

    // 移除前擁有者權限（降為 member）
    await tx
      .update(members)
      .set({
        role: 'member',
        roleId: null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, currentOwnerId));
  });

  revalidateTag(`membership:${newOwnerId}`, "default");
  revalidateTag(`membership:${currentOwnerId}`, "default");
  revalidatePath("/portal/account/team");

  return { success: true };
}

/**
 * 重設成員密碼
 * 統一使用 members 表
 */
async function resetMemberPassword({
  actorMemberId,
  targetMemberId,
  newPassword,
}: {
  actorMemberId: string;
  targetMemberId: string;
  newPassword: string;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  const { hashPassword } = await import("@heiso-io/bee/lib/hash");

  // 驗證操作者身份
  const actor = await db.query.members.findFirst({
    where: (t, { eq }) => eq(t.id, actorMemberId),
  });

  if (!actor) {
    return { success: false, error: "ACTOR_NOT_FOUND" };
  }
  if (actor.id !== session.user.id) {
    return { success: false, error: "UNAUTHORIZED" };
  }
  if (actor.role !== 'owner') {
    return { success: false, error: "PERMISSION_DENIED" };
  }

  // 取得目標帳號
  const target = await db.query.members.findFirst({
    where: (t, { eq }) => eq(t.id, targetMemberId),
  });

  if (!target) {
    return { success: false, error: "TARGET_NOT_FOUND" };
  }

  // 更新密碼
  const hashedPassword = await hashPassword(newPassword);
  await db
    .update(members)
    .set({
      password: hashedPassword,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(members.id, targetMemberId));

  return { success: true };
}

export {
  getTeamMembers,
  invite,
  updateMember,
  sendApproved,
  sendInvite,
  resendInvite,
  revokeInvite,
  leaveTeam,
  addMember,
  transferOwnership,
  resetMemberPassword,
};
