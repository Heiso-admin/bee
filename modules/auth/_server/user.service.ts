"use server";

import { sendInvite } from "@heiso-io/bee/modules/permission/team/_server/team.service";
import { type Transaction } from "@heiso-io/bee/lib/db";
import { members } from "@heiso-io/bee/lib/db/schema";
import { generateInviteToken } from "@heiso-io/bee/lib/id-generator";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@heiso-io/bee/lib/db";


/**
 * 取得所有帳號 (用於管理介面)
 */
export async function getAccounts() {

  const result = await db.query.members.findMany({
    where: (t, { isNull }) => isNull(t.deletedAt),
  });
  return result;
}

/**
 * 取得成員的登入方式（per-role）。
 * - owner：全部開（structural bypass）
 * - 有 custom role：用該 role 的 allow_* flags
 * - 沒 role：default 寬鬆（magic link + password）
 *
 * 給 /auth/login 流程決定下一步用。
 */
export type MemberAuthMethods = {
  allowMagicLink: boolean;
  allowPassword: boolean;
  allowTwoFactor: boolean;
};

const DEFAULT_AUTH_METHODS: MemberAuthMethods = {
  allowMagicLink: true,
  allowPassword: true,
  allowTwoFactor: false,
};

const OWNER_AUTH_METHODS: MemberAuthMethods = {
  allowMagicLink: true,
  allowPassword: true,
  allowTwoFactor: true,
};

export async function getMemberAuthMethods(memberId: string): Promise<MemberAuthMethods> {
  const member = await db.query.members.findFirst({
    columns: { role: true, roleId: true },
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
    with: {
      customRole: {
        columns: {
          allowMagicLink: true,
          allowPassword: true,
          allowTwoFactor: true,
        },
      },
    },
  });

  if (!member) return DEFAULT_AUTH_METHODS;
  if (member.role === "owner") return OWNER_AUTH_METHODS;
  if (!member.customRole) return DEFAULT_AUTH_METHODS;

  return {
    allowMagicLink: member.customRole.allowMagicLink,
    allowPassword: member.customRole.allowPassword,
    allowTwoFactor: member.customRole.allowTwoFactor,
  };
}

/**
 * @deprecated Use `getMemberAuthMethods()` instead. Backward-compat shim while
 * we phase out `members.login_method` column. Returns one of "both" | "email" | "otp"
 * by collapsing the 3 role flags with precedence 2FA > password > magic-link.
 */
export async function getLoginMethod(memberId: string) {
  const flags = await getMemberAuthMethods(memberId);
  if (flags.allowTwoFactor) return "both" as const;
  if (flags.allowPassword) return "email" as const;
  if (flags.allowMagicLink) return "otp" as const;
  return "email" as const;
}

/**
 * 取得成員狀態
 * 統一使用 members 表
 * @param memberId - Account ID
 */
export async function getMemberStatus(memberId: string) {

  const member = await db.query.members.findFirst({
    columns: { status: true },
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });
  return member?.status ?? null;
}

/**
 * 透過 memberId 取得成員資訊
 * 統一使用 members 表
 * @param memberId - Account ID
 */
export async function getMember(memberId: string) {

  const member = await db.query.members.findFirst({
    columns: {
      id: true,
      email: true,
      name: true,
      status: true,
      roleId: true,
      role: true,
    },
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });

  if (!member) return null;

  return {
    id: member.id,
    memberId: member.id,
    email: member.email,
    name: member.name,
    status: member.status,
    roleId: member.roleId,
    role: member.role,
  };
}

/**
 * 透過 memberId 取得成員的邀請 token
 * 統一使用 members 表
 * @param memberId - Account ID
 */
export async function getMemberInviteToken(memberId: string) {

  const member = await db.query.members.findFirst({
    columns: { inviteToken: true },
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });
  return member?.inviteToken ?? null;
}

/**
 * 取得帳號資訊
 * @param memberId - Account ID
 */
export async function getAccount(memberId: string) {

  const member = await db.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });
  return member ?? null;
}

/**
 * 重寄邀請 email 給成員
 * @param email - Email
 */
export async function resendInviteByEmail(email: string) {
  const member = await getMemberByEmail(email);
  if (!member) {
    throw new Error("Account not found");
  }
  return resendInviteByAccountId(member.id);
}

/**
 * 重寄邀請 email 給成員
 * 統一使用 members 表
 * @param memberId - Account ID
 */
export async function resendInviteByAccountId(memberId: string) {
  const inviteToken = generateInviteToken();
  const inviteExpiredAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const member = await db.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });

  if (!member) {
    throw new Error("Account not found");
  }

  await db
    .update(members)
    .set({
      inviteToken,
      inviteExpiredAt,
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId));

  const result = await sendInvite({
    email: member.email,
    inviteToken,
    isOwner: member.role === "owner",
  });

  return result;
}

/**
 * 確保帳號有有效的邀請 token（不發送 email）
 * - 若 token 遺失或過期，刷新 token
 * 統一使用 members 表
 * @param memberId - Account ID
 */
export async function ensureInviteTokenSilently(memberId: string) {
  const now = Date.now();

  const member = await db.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });

  if (!member) return null;

  const needsNewToken =
    !member.inviteToken ||
    !member.inviteExpiredAt ||
    member.inviteExpiredAt.getTime() < now;

  if (needsNewToken) {
    const inviteToken = generateInviteToken();
    const inviteExpiredAt = new Date(now + 1000 * 60 * 60 * 24 * 7);

    const [updated] = await db
      .update(members)
      .set({
        inviteToken,
        inviteExpiredAt,
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberId))
      .returning({ inviteToken: members.inviteToken });

    return updated?.inviteToken ?? null;
  }

  return member.inviteToken;
}

/**
 * 首次登入：設定帳號狀態為 active
 * 統一使用 members 表
 *
 * 若租戶 DB 中查無帳號（例如透過 Hive CLI 建立的帳號），
 * 會從 cell DB 拉取帳號資訊並 INSERT 至租戶 DB。
 *
 * @param memberId - Account ID
 * @param tx - 可選的 transaction
 */
export async function ensureMemberOnFirstLogin(
  memberId: string,
  tx?: Transaction,
) {
  const d = tx ?? db;

  let member = await d.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.id, memberId), isNull(t.deletedAt)),
  });

  if (!member) {
    return null;
  }

  const existingOwner = await d.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.role, "owner"), isNull(t.deletedAt)),
    columns: { id: true },
  });

  const shouldBeOwner = !existingOwner;
  let assignedRoleId = member.roleId;

  if ((shouldBeOwner || member.role === "owner") && !assignedRoleId) {
    const adminRole = await d.query.roles.findFirst({
      where: (t, { eq, isNull }) =>
        and(eq(t.name, "Admin"), isNull(t.deletedAt)),
      columns: { id: true },
    });
    if (adminRole) {
      assignedRoleId = adminRole.id;
    }
  }

  const [updated] = await d
    .update(members)
    .set({
      roleId: assignedRoleId,
      status: "active",
      role: member.role === "owner" || shouldBeOwner ? "owner" : member.role,
      joinedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId))
    .returning({
      id: members.id,
      status: members.status,
      role: members.role,
    });

  if (updated) {
    try {
      const { revalidateTag } = await import("next/cache");
      revalidateTag(`membership:${updated.id}`, "default");
    } catch {}
  }
  return updated
    ? { ...updated, memberId: updated.id }
    : null;
}

/**
 * 檢查當前 tenant 是否有 owner
 * 統一使用 members 表
 */
export async function checkTenantHasOwner() {

  const owner = await db.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.role, "owner"), isNull(t.deletedAt)),
    columns: { id: true },
  });
  return !!owner;
}

/**
 * 透過 email 取得帳號
 */
export async function getMemberByEmail(email: string) {

  const member = await db.query.members.findFirst({
    where: (t, { eq }) => eq(t.email, email),
  });
  return member ?? null;
}

/**
 * 透過 email 取得帳號 (包含密碼)
 */
export async function getAccountWithPasswordByEmail(email: string) {
  const member = await db.query.members.findFirst({
    where: (t, { eq, isNull }) =>
      and(eq(t.email, email), isNull(t.deletedAt)),
  });

  if (!member) return null;

  return {
    id: member.id,
    email: member.email,
    name: member.name,
    password: member.password,
    active: member.active,
    avatar: member.avatar,
    lastLoginAt: member.lastLoginAt,
  };
}

