"use server";

import { settings } from "@heiso-io/bee/config/settings";
import { db } from "@heiso-io/bee/lib/db";
import { memberPasswordReset, members } from "@heiso-io/bee/lib/db/schema";
import { sendForgotPasswordEmail } from "@heiso-io/bee/lib/email";
import { hashPassword } from "@heiso-io/bee/lib/hash";
import { generateId } from "@heiso-io/bee/lib/id-generator";
import { consumeRateLimit } from "@heiso-io/bee/lib/rate-limit";
import { eq } from "drizzle-orm";
import { ALLOWED_DEV_EMAILS } from "@heiso-io/bee/modules/auth/auth.config";
import { getMemberByEmail } from "./user.service";

async function updatePassword(
  memberId: string,
  hashedPassword: string,
  mustChange: boolean = false,
) {
  await db
    .update(members)
    .set({
      password: hashedPassword,
      mustChangePassword: mustChange,
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId));
}

/**
 * Request password reset: generate token, persist, and send reset email
 */
export async function requestPasswordReset(email: string) {
  // SECURITY: rate limit password reset requests per email (5 / 15 min)
  const { allowed } = consumeRateLimit(`pwd-reset:${email}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return { ok: true }; // 不告知 attacker 被限流（防 email enumeration）
  }

  // dev 帳號禁止 password reset（僅走 OTP），silently no-op
  if (ALLOWED_DEV_EMAILS.includes(email.trim().toLowerCase())) {
    return { ok: true };
  }

  const member = await getMemberByEmail(email);

  if (!member) {
    return { ok: true };
  }

  const token = generateId(undefined, 32);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await db.insert(memberPasswordReset).values({
    memberId: member.id,
    token,
    expiresAt,
    used: false,
  });

  const { NOTIFY_EMAIL, BASE_HOST } = await settings();
  const resetLink = `${BASE_HOST}/auth/reset-password?token=${token}`;

  await sendForgotPasswordEmail({
    from: NOTIFY_EMAIL as string,
    to: [email],
    subject: "Reset your password",
    resetLink,
    name: member.name ?? "",
  });

  return { ok: true };
}

/**
 * Reset password using token: validate, update user password, mark token used
 */
export async function resetPassword(token: string, newPassword: string) {
  const record = await db.query.memberPasswordReset.findFirst({
    where: (t, { and, eq, gt }) =>
      and(eq(t.token, token), eq(t.used, false), gt(t.expiresAt, new Date())),
  });

  if (!record || !record.memberId) {
    throw new Error("Invalid or expired reset token");
  }

  const hashedPassword = await hashPassword(newPassword);

  await updatePassword(record.memberId, hashedPassword, false);

  await db
    .update(memberPasswordReset)
    .set({ used: true })
    .where(eq(memberPasswordReset.id, record.id));

  return { ok: true };
}

/**
 * Directly change the user's password
 */
export async function changePassword(memberId: string, newPassword: string) {
  const hashedPassword = await hashPassword(newPassword);
  await updatePassword(memberId, hashedPassword, false);
}
