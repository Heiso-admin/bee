"use server";

import { db } from "@heiso-io/bee/lib/db";
import type { TMember } from "@heiso-io/bee/lib/db/schema/auth/members";
import { members } from "@heiso-io/bee/lib/db/schema/auth/members";
import { eq } from "drizzle-orm";

/**
 * 取得 member by Email
 */
export async function getMemberByEmail(
  email: string,
): Promise<TMember | null> {
  const member = await db.query.members.findFirst({
    where: (t, { eq }) => eq(t.email, email),
  });
  return member || null;
}

/**
 * 取得 member by ID
 */
export async function getMemberById(id: string): Promise<TMember | null> {
  const member = await db.query.members.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  return member || null;
}

/**
 * 建立 member
 */
export async function createMember(data: {
  email: string;
  name: string;
  password: string;
  role?: string;
  status?: string;
}): Promise<TMember> {
  const [member] = await db
    .insert(members)
    .values({
      email: data.email,
      name: data.name,
      password: data.password,
      role: (data.role as any) || "member",
      status: (data.status as any) || "invited",
      active: true,
    })
    .returning();

  return member;
}

/**
 * 更新 member
 */
export async function updateMember(
  id: string,
  data: Partial<TMember>,
): Promise<void> {
  await db
    .update(members)
    .set(data as any)
    .where(eq(members.id, id));
}

/**
 * 驗證密碼
 */
export async function verifyPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const member = await db.query.members.findFirst({
    where: (t, { eq }) => eq(t.email, email),
    columns: { password: true },
  });

  if (!member) return false;

  const { verifyPassword: verifyHash } = await import("@heiso-io/bee/lib/hash");
  return await verifyHash(password, member.password);
}

/**
 * 檢查是否有任何 member
 */
export async function hasAnyMember(): Promise<boolean> {
  const first = await db.query.members.findFirst({
    columns: { id: true },
  });
  return !!first;
}
