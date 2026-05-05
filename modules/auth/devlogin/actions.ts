"use server";

import { settings } from "@bee/core/config/settings";
import TwoFactorEmail from "@bee/core/emails/2fa";
import { sendEmail } from "@bee/core/lib/email";
import { ALLOWED_DEV_EMAILS } from "@bee/core/modules/auth/auth.config";
import { getAccountWithPasswordByEmail } from "@bee/core/modules/auth/_server/user.service";
import { db } from "@bee/core/lib/db";
import { accounts } from "@bee/core/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * 確保 DevLogin 帳號存在
 */
async function ensureDevAccountExists(email: string) {
  const existing = await getAccountWithPasswordByEmail(email);
  if (existing) {
    return existing;
  }

  const { hashPassword } = await import("@bee/core/lib/hash");
  const { generateId } = await import("@bee/core/lib/id-generator");

  const randomPassword = await hashPassword(generateId(undefined, 32));
  const displayName = email === "pm@heiso.io" ? "Core PM" : "Core Dev";

  const [account] = await db
    .insert(accounts)
    .values({
      email,
      name: displayName,
      password: randomPassword,
      role: "owner",
      status: "active",
      active: true,
    })
    .returning();

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    password: account.password,
    active: account.active,
    avatar: account.avatar,
    lastLoginAt: account.lastLoginAt,
  };
}

// Generate 6-digit OTP code
function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP for DevLogin
 * - Validates email is in allowed list
 * - Ensures account exists (creates if needed)
 * - Generates and sends OTP
 */
export async function sendDevOTP(email: string): Promise<{
  success: boolean;
  error?: string;
  expiresAt?: Date;
}> {
  // 1. Strict email check
  if (!ALLOWED_DEV_EMAILS.includes(email)) {
    return {
      success: false,
      error: "Access Denied. Only authorized emails are allowed.",
    };
  }

  try {
    // 2. Ensure account exists (create if needed)
    const account = await ensureDevAccountExists(email);
    if (!account) {
      return {
        success: false,
        error: "Failed to create or find account",
      };
    }

    // 3. Generate OTP
    const { user2faCode } = await import("@bee/core/lib/db/schema");
    const { and, lt } = await import("drizzle-orm");

    // Clean up expired OTPs for this account
    const now = new Date();
    await db
      .delete(user2faCode)
      .where(
        and(
          eq(user2faCode.accountId, account.id),
          lt(user2faCode.expiresAt, now),
        ),
      );

    // Generate new OTP
    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save to database
    await db.insert(user2faCode).values({
      accountId: account.id,
      code,
      used: false,
      expiresAt,
    });

    // 4. Send email
    const assets = await db.query.settings.findFirst({
      where: (t, { eq, and }) => and(eq(t.name, "assets"), eq(t.group, "site")),
    });
    const { logo } = (assets?.value || {}) as Record<string, string>;

    const { NOTIFY_EMAIL } = await settings();
    await sendEmail({
      from: (NOTIFY_EMAIL as string) || "noreply@heiso.com",
      to: [email],
      subject: "[DevLogin] Your Verification Code",
      body: TwoFactorEmail({
        logoUrl: logo,
        code,
        username: account.name,
        expiresInMinutes: 10,
      }),
    });

    console.log(`[DevLogin] OTP sent to ${email}`); // 不記 plaintext code

    return {
      success: true,
      expiresAt,
    };
  } catch (error) {
    console.error("[sendDevOTP] Failed:", error);
    return {
      success: false,
      error: "Failed to send OTP. Please try again.",
    };
  }
}

/**
 * Verify OTP for DevLogin
 * Returns accountId on success for signIn
 */
export async function verifyDevOTP(
  email: string,
  code: string,
): Promise<{
  success: boolean;
  error?: string;
  accountId?: string;
}> {
  // 1. Strict email check
  if (!ALLOWED_DEV_EMAILS.includes(email)) {
    return {
      success: false,
      error: "Access Denied",
    };
  }

  try {
    const { user2faCode } = await import("@bee/core/lib/db/schema");
    const { and, gt } = await import("drizzle-orm");

    // Find account
    const account = await getAccountWithPasswordByEmail(email);
    if (!account) {
      return {
        success: false,
        error: "Account not found",
      };
    }

    // Find valid OTP
    const otpRecord = await db.query.user2faCode.findFirst({
      where: and(
        eq(user2faCode.accountId, account.id),
        eq(user2faCode.code, code),
        eq(user2faCode.used, false),
        gt(user2faCode.expiresAt, new Date()),
      ),
    });

    if (!otpRecord) {
      return {
        success: false,
        error: "Invalid or expired code",
      };
    }

    // Mark OTP as used
    await db
      .update(user2faCode)
      .set({ used: true })
      .where(eq(user2faCode.id, otpRecord.id));

    return {
      success: true,
      accountId: account.id,
    };
  } catch (error) {
    console.error("[verifyDevOTP] Failed:", error);
    return {
      success: false,
      error: "Verification failed. Please try again.",
    };
  }
}
