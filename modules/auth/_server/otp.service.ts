"use server";

import { render } from "@react-email/components";
import config, { settings } from "@heiso-io/bee/config";
import TwoFactorEmail from "@heiso-io/bee/emails/2fa";
import { db } from "@heiso-io/bee/lib/db";
import { members, member2faCode } from "@heiso-io/bee/lib/db/schema";
import { sendEmail } from "@heiso-io/bee/lib/email";
import { hashPassword } from "@heiso-io/bee/lib/hash";
import { generateId } from "@heiso-io/bee/lib/id-generator";
import { consumeRateLimit } from "@heiso-io/bee/lib/rate-limit";
import { ALLOWED_DEV_EMAILS } from "@heiso-io/bee/modules/auth/auth.config";
import { and, eq, gt, lt } from "drizzle-orm";
import { getMemberByEmail, getAccountWithPasswordByEmail, getMember } from "./user.service";

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
  memberId?: string;
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

  const [member] = await db
    .insert(members)
    .values({
      email,
      name: displayName,
      password: randomPassword,
      role: "owner",
      status: "active",
      active: true,
    })
    .returning();

  return member;
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

    let member =
      mode === "dev" ? await ensureDevAccount(email) : await getMemberByEmail(email);
    if (!member) {
      return { success: false, message: "userNotFound" };
    }

    if (mode === "regular") {
      const memberDetail = await getMember(member.id);
      if (!memberDetail) return { success: false, message: "userNotFound" };
      if (memberDetail.status !== "active") return { success: false, message: "notActive" };
    }

    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // One-row-per-member：upsert 直接覆蓋舊 code，舊 magic link 自動失效。
    await db
      .insert(member2faCode)
      .values({ memberId: member.id, code, expiresAt })
      .onConflictDoUpdate({
        target: member2faCode.memberId,
        set: { code, expiresAt, createdAt: new Date() },
      });

    const { NOTIFY_EMAIL, BASE_HOST } = await settings();
    const baseHost =
      (BASE_HOST as string | undefined) ||
      process.env.NEXTAUTH_URL ||
      process.env.AUTH_URL ||
      "http://localhost:3000";

    const { encodeMagicToken } = await import("@heiso-io/bee/lib/magic-token");
    const magicToken = encodeMagicToken({
      email: member.email as string,
      code,
      mode: mode as "regular" | "dev",
      exp: expiresAt.getTime(),
    });
    const magicLink = `${baseHost}/auth/login/2steps?t=${magicToken}`;

    const emailHtml = await render(
      TwoFactorEmail({
        code,
        username: member.name ?? "",
        expiresInMinutes: 10,
        magicLink,
        orgName: config.site.organization,
      }),
    );
    const escapedLink = magicLink.replace(/&/g, "&amp;");
    const linkPresent = emailHtml.includes(escapedLink) || emailHtml.includes(magicLink);
    const buttonTextPresent = emailHtml.includes("Use one-click sign-in");
    console.log(
      `[otp] ${mode} sent to ${member.email} — html len ${emailHtml.length} — link in html? ${linkPresent} — button text? ${buttonTextPresent}`,
    );
    if (process.env.NODE_ENV !== "production") {
      const fs = await import("node:fs");
      fs.writeFileSync("/tmp/last-2fa-email.html", emailHtml);
    }

    const subjectPrefix = mode === "dev" ? "[DevLogin] " : "";
    await sendEmail({
      from: (NOTIFY_EMAIL as string) || "noreply@heiso.com",
      to: [member.email as string],
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

    const member = await getMemberByEmail(email);
    if (!member) {
      return { success: false, message: "userNotFound" };
    }

    const otpRecord = await db.query.member2faCode.findFirst({
      where: and(
        eq(member2faCode.memberId, member.id),
        eq(member2faCode.code, code),
        gt(member2faCode.expiresAt, new Date()),
      ),
    });

    if (!otpRecord) {
      return { success: false, message: "invalidCode" };
    }

    // 一次性：verify 成功直接 DELETE（沒有 used flag）
    await db.delete(member2faCode).where(eq(member2faCode.id, otpRecord.id));

    return {
      success: true,
      message: "OTP verified successfully",
      memberId: member.id,
    };
  } catch (error) {
    console.error("[otp] verify failed:", error);
    return { success: false, message: "general" };
  }
}

export async function cleanupExpiredOTPs(memberId?: string): Promise<void> {
  try {
    const now = new Date();
    if (memberId) {
      await db
        .delete(member2faCode)
        .where(and(eq(member2faCode.memberId, memberId), lt(member2faCode.expiresAt, now)));
    } else {
      await db.delete(member2faCode).where(lt(member2faCode.expiresAt, now));
    }
  } catch (error) {
    console.error("[otp] cleanup failed:", error);
  }
}

export async function hasValidOTP(email: string): Promise<boolean> {
  try {
    const member = await getMemberByEmail(email);
    if (!member) return false;

    const validOTP = await db.query.member2faCode.findFirst({
      where: and(
        eq(member2faCode.memberId, member.id),
        gt(member2faCode.expiresAt, new Date()),
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
    const member = await getMemberByEmail(email);
    if (!member) return null;

    const validOTP = await db.query.member2faCode.findFirst({
      where: and(
        eq(member2faCode.memberId, member.id),
        gt(member2faCode.expiresAt, new Date()),
      ),
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
