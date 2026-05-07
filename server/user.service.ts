"use server";

import {
  getMemberByEmail as getAccountByEmailAdapter,
  getMemberById,
  updateMember,
} from "@heiso-io/bee/lib/members/member-adapter";
import { db } from "@heiso-io/bee/lib/db";
import type { TMember } from "@heiso-io/bee/lib/db/schema";

// 包成 async function（"use server" 不允許同步 re-export，否則 build 時會被當 server action wrapper、runtime crash）
export async function getMemberByEmail(email: string) {
  return getAccountByEmailAdapter(email);
}

/**
 * Get all members
 */
export async function getUsers() {

  return await db.query.members.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getUserById(id: string) {
  return await getMemberById(id);
}

/**
 * 透過邀請 token 取得邀請資訊
 * 統一使用 members 表
 */
export async function getInvitation(token: string) {

  const member = await db.query.members.findFirst({
    columns: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      inviteToken: true,
      inviteExpiredAt: true,
      status: true,
    },
    where: (table, { eq, isNull, and }) =>
      and(eq(table.inviteToken, token), isNull(table.deletedAt)),
  });

  if (!member) {
    return {
      invitation: null,
      user: null,
    };
  }

  return {
    invitation: {
      id: member.id,
      memberId: member.id,
      inviteToken: member.inviteToken,
      inviteExpiredAt: member.inviteExpiredAt,
      status: member.status,
    },
    user: {
      id: member.id,
      email: member.email,
      name: member.name,
      avatar: member.avatar,
    },
  };
}

export async function getAccount(id: string) {
  return await getMemberById(id);
}

export async function getUser(email: string) {
  return await getAccountByEmailAdapter(email);
}

/**
 * Update account


 */
export async function update(id: string, data: Partial<TMember>) {
  try {
    await updateMember(id, data);
  } catch (error) {
    console.error("Failed to update account:", error);
    throw error;
  }
}
