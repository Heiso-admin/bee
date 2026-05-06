"use server";

import { render } from "@react-email/components";
import config, { settings } from "@heiso-io/bee/config";
import TwoFactorEmail from "@heiso-io/bee/emails/2fa";
import { db } from "@heiso-io/bee/lib/db";
import { accounts, user2faCode } from "@heiso-io/bee/lib/db/schema";
import { sendEmail } from "@heiso-io/bee/lib/email";
import { hashPassword } from "@heiso-io/bee/lib/hash";
import { generateId } from "@heiso-io/bee/lib/id-generator";
import { consumeRateLimit } from "@heiso-io/bee/lib/rate-limit";
import { ALLOWED_DEV_EMAILS } from "@heiso-io/bee/modules/auth/auth.config";
import { and, eq, gt, lt } from "drizzle-orm";
import { getAccountByEmail, getAccountWithPasswordByEmail, getMember } from "./user.service";

export type OTPMode = "regular" | "dev";

export interface OTPOptions {
  /** "regular" (default) requires existing active member; "dev" auto-creates account in ALLOWED_DEV_EMAILS list. */
  mode?: OTPMode;
}

export interface OTPGenerationResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
}

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  accountId?: string;
}

function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** dev mode: 帳號不存在自動建立(限 ALLOWED_DEV_EMAILS) */
async function ensureDevAccount(email: string) {
  const existing = await getAccountWithPasswordByEmail(email);
  if (existing) return existing;

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

  return account;
}

/**
 * 生成 OTP 並寄信。
 * - regular: 必須有 active member,5/15min rate limit
 * - dev: ALLOWED_DEV_EMAILS 白名單,沒帳號就建立,不 rate limit
 */
export async function generateOTP(
  email: string,
  opts: OTPOptions = {},
): Promise<OTPGenerationResult> {
  const mode = opts.mode ?? "regular";

  try {
    if (mode === "dev") {
      if (!ALLOWED_DEV_EMAILS.includes(email)) {
        return { success: false, message: "accessDenied" };
      }
    } else {
      // regular: rate limit
      const { allowed, retryAfter } = consumeRateLimit(`otp:${email}`, 5, 15 * 60 * 1000);
      if (!allowed) {
        return {
          success: false,
          message: `Too many OTP requests. Try again in ${retryAfter}s.`,
        };
      }
    }

    let account =
      mode === "dev" ? await ensureDevAccount(email) : await getAccountByEmail(email);
    if (!account) {
      return { success: false, message: "userNotFound" };
    }

    if (mode === "regular") {
      const member = await getMember(account.id);
      if (!member) return { success: false, message: "userNotFound" };
      if (member.status !== "active") return { success: false, message: "notActive" };
    }

    await cleanupExpiredOTPs(account.id);

    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(user2faCode).values({
      accountId: account.id,
      code,
      used: false,
      expiresAt,
    });

    const { NOTIFY_EMAIL, BASE_HOST } = await settings();
    const baseHost =
      (BASE_HOST as string | undefined) ||
      process.env.NEXTAUTH_URL ||
      process.env.AUTH_URL ||
      "http://localhost:3000";

    const modeQS = mode === "dev" ? "&mode=dev" : "";
    const magicLink = `${baseHost}/auth/login/2steps?email=${encodeURIComponent(account.email as string)}&code=${code}${modeQS}`;

    const emailHtml = await render(
      TwoFactorEmail({
        code,
        username: account.name ?? "",
        expiresInMinutes: 10,
        magicLink,
        orgName: config.site.organization,
      }),
    );
    const escapedLink = magicLink.replace(/&/g, "&amp;");
    const linkPresent = emailHtml.includes(escapedLink) || emailHtml.includes(magicLink);
    const buttonTextPresent = emailHtml.includes("Use one-click sign-in");
    console.log(
      `[otp] ${mode} sent to ${account.email} — html len ${emailHtml.length} — link in html? ${linkPresent} — button text? ${buttonTextPresent}`,
    );
    if (process.env.NODE_ENV !== "production") {
      const fs = await import("node:fs");
      fs.writeFileSync("/tmp/last-2fa-email.html", emailHtml);
    }

    const subjectPrefix = mode === "dev" ? "[DevLogin] " : "";
    await sendEmail({
      from: (NOTIFY_EMAIL as string) || "noreply@heiso.com",
      to: [account.email as string],
      subject: `${subjectPrefix}Sign in to ${config.site.organization}`,
      body: emailHtml,
    });

    return { success: true, message: "OTP sent successfully", expiresAt };
  } catch (error) {
    console.error("[otp] generate failed:", error);
    return { success: false, message: "general" };
  }
}

/**
 * 驗證 OTP code。dev mode 會額外檢查 ALLOWED_DEV_EMAILS。
 */
export async function verifyOTP(
  email: string,
  code: string,
  opts: OTPOptions = {},
): Promise<OTPVerificationResult> {
  const mode = opts.mode ?? "regular";

  try {
    if (mode === "dev" && !ALLOWED_DEV_EMAILS.includes(email)) {
      return { success: false, message: "accessDenied" };
    }

    const account = await getAccountByEmail(email);
    if (!account) {
      return { success: false, message: "userNotFound" };
    }

    const otpRecord = await db.query.user2faCode.findFirst({
      where: and(
        eq(user2faCode.accountId, account.id),
        eq(user2faCode.code, code),
        eq(user2faCode.used, false),
        gt(user2faCode.expiresAt, new Date()),
      ),
    });

    if (!otpRecord) {
      return { success: false, message: "invalidCode" };
    }

    await db
      .update(user2faCode)
      .set({ used: true })
      .where(eq(user2faCode.id, otpRecord.id));

    return {
      success: true,
      message: "OTP verified successfully",
      accountId: account.id,
    };
  } catch (error) {
    console.error("[otp] verify failed:", error);
    return { success: false, message: "general" };
  }
}

export async function cleanupExpiredOTPs(accountId?: string): Promise<void> {
  try {
    const now = new Date();
    if (accountId) {
      await db
        .delete(user2faCode)
        .where(and(eq(user2faCode.accountId, accountId), lt(user2faCode.expiresAt, now)));
    } else {
      await db.delete(user2faCode).where(lt(user2faCode.expiresAt, now));
    }
  } catch (error) {
    console.error("[otp] cleanup failed:", error);
  }
}

export async function hasValidOTP(email: string): Promise<boolean> {
  try {
    const account = await getAccountByEmail(email);
    if (!account) return false;

    const validOTP = await db.query.user2faCode.findFirst({
      where: and(
        eq(user2faCode.accountId, account.id),
        eq(user2faCode.used, false),
        gt(user2faCode.expiresAt, new Date()),
      ),
    });

    return !!validOTP;
  } catch (error) {
    console.error("[otp] hasValidOTP failed:", error);
    return false;
  }
}

export async function getOTPStatus(email: string) {
  try {
    const account = await getAccountByEmail(email);
    if (!account) return null;

    const validOTP = await db.query.user2faCode.findFirst({
      where: and(
        eq(user2faCode.accountId, account.id),
        eq(user2faCode.used, false),
        gt(user2faCode.expiresAt, new Date()),
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return {
      hasValidOTP: !!validOTP,
      expiresAt: validOTP?.expiresAt,
      twoFactorEnabled: false,
    };
  } catch (error) {
    console.error("[otp] getOTPStatus failed:", error);
    return null;
  }
}
