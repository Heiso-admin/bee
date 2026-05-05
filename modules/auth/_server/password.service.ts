"use server";

import { settings } from "@bee/core/config/settings";
import { db } from "@bee/core/lib/db";
import { userPasswordReset, accounts } from "@bee/core/lib/db/schema";
import { sendForgotPasswordEmail } from "@bee/core/lib/email";
import { hashPassword } from "@bee/core/lib/hash";
import { generateId } from "@bee/core/lib/id-generator";
import { consumeRateLimit } from "@bee/core/lib/rate-limit";
import { eq } from "drizzle-orm";
import { getAccountByEmail } from "./user.service";

async function updatePassword(
  accountId: string,
  hashedPassword: string,
  mustChange: boolean = false,
) {
  await db
    .update(accounts)
    .set({
      password: hashedPassword,
      mustChangePassword: mustChange,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));
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

  const account = await getAccountByEmail(email);

  if (!account) {
    return { ok: true };
  }

  const token = generateId(undefined, 32);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await db.insert(userPasswordReset).values({
    accountId: account.id,
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
    name: account.name ?? "",
  });

  return { ok: true };
}

/**
 * Reset password using token: validate, update user password, mark token used
 */
export async function resetPassword(token: string, newPassword: string) {
  const record = await db.query.userPasswordReset.findFirst({
    where: (t, { and, eq, gt }) =>
      and(eq(t.token, token), eq(t.used, false), gt(t.expiresAt, new Date())),
  });

  if (!record || !record.accountId) {
    throw new Error("Invalid or expired reset token");
  }

  const hashedPassword = await hashPassword(newPassword);

  await updatePassword(record.accountId, hashedPassword, false);

  await db
    .update(userPasswordReset)
    .set({ used: true })
    .where(eq(userPasswordReset.id, record.id));

  return { ok: true };
}

/**
 * Directly change the user's password
 */
export async function changePassword(accountId: string, newPassword: string) {
  const hashedPassword = await hashPassword(newPassword);
  await updatePassword(accountId, hashedPassword, false);
}
