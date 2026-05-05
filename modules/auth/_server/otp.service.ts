"use server";

import { settings } from "@bee/core/config/settings";
import TwoFactorEmail from "@bee/core/emails/2fa";
import { db } from "@bee/core/lib/db";
import { user2faCode } from "@bee/core/lib/db/schema";
import { sendEmail } from "@bee/core/lib/email";
import { consumeRateLimit } from "@bee/core/lib/rate-limit";
import { and, eq, gt, lt } from "drizzle-orm";
import { getAccountByEmail, getMember } from "./user.service";

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

/**
 * 生成6位数字验证码
 */
function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 为用户生成 OTP 验证码并发送邮件
 */
export async function generateOTP(email: string): Promise<OTPGenerationResult> {
  try {
    // SECURITY: rate limit OTP requests per email (5 / 15 min)
    const { allowed, retryAfter } = consumeRateLimit(`otp:${email}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return {
        success: false,
        message: `Too many OTP requests. Try again in ${retryAfter}s.`,
      };
    }

    const account = await getAccountByEmail(email);
    if (!account) {
      return {
        success: false,
        message: "userNotFound",
      };
    }


    // 檢查使用者是否為 active 成員
    const member = await getMember(account.id);
    if (!member) {
      return {
        success: false,
        message: "userNotFound",
      };
    }

    if (member.status !== "active") {
      return {
        success: false,
        message: "notActive",
      };
    }

    // 清理该用户的过期验证码
    await cleanupExpiredOTPs(account.id);

    // 生成新的验证码
    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 保存到数据库
    await db.insert(user2faCode).values({
      accountId: account.id,
      code,
      used: false,
      expiresAt,
    });

    const assets = await db.query.settings.findFirst({
      where: (t, { eq, and }) => and(eq(t.name, "assets"), eq(t.group, "site")),
    });

    const { logo } = (assets?.value || {}) as Record<string, string>;

    // 发送邮件
    const { NOTIFY_EMAIL } = await settings();
    await sendEmail({
      from: (NOTIFY_EMAIL as string) || "noreply@heiso.com",
      to: [account.email as string],
      subject: "Your Login Verification Code",
      body: TwoFactorEmail({
        logoUrl: logo,
        code,
        username: account.name ?? "",
        expiresInMinutes: 10,
      }),
    });

    return {
      success: true,
      message: "OTP sent successfully",
      expiresAt,
    };
  } catch (error) {
    console.error("Failed to generating OTP:", error);
    return {
      success: false,
      message: "general",
    };
  }
}

/**
 * 验证 OTP 验证码
 */
export async function verifyOTP(
  email: string,
  code: string,
): Promise<OTPVerificationResult> {
  try {
    // 查找用户
    const account = await getAccountByEmail(email);

    if (!account) {
      return {
        success: false,
        message: "userNotFound",
      };
    }

    // 查找有效的验证码
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
        message: "invalidCode",
      };
    }

    // 标记验证码为已使用
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
    console.error("Error verifying OTP:", error);
    return {
      success: false,
      message: "Failed to verify OTP",
    };
  }
}

/**
 * 清理过期的 OTP 验证码
 */
export async function cleanupExpiredOTPs(accountId?: string): Promise<void> {
  try {
    const now = new Date();

    if (accountId) {
      // 清理特定用户的过期验证码
      await db
        .delete(user2faCode)
        .where(
          and(eq(user2faCode.accountId, accountId), lt(user2faCode.expiresAt, now)),
        );
    } else {
      // 清理所有过期验证码
      await db.delete(user2faCode).where(lt(user2faCode.expiresAt, now));
    }
  } catch (error) {
    console.error("Error cleaning up expired OTPs:", error);
  }
}

/**
 * 检查用户是否有未使用的有效 OTP
 */
export async function hasValidOTP(email: string): Promise<boolean> {
  try {
    const account = await getAccountByEmail(email);

    if (!account) {
      return false;
    }

    const validOTP = await db.query.user2faCode.findFirst({
      where: and(
        eq(user2faCode.accountId, account.id),
        eq(user2faCode.used, false),
        gt(user2faCode.expiresAt, new Date()),
      ),
    });

    return !!validOTP;
  } catch (error) {
    console.error("Error checking valid OTP:", error);
    return false;
  }
}

/**
 * 获取用户的 OTP 状态信息
 */
export async function getOTPStatus(email: string) {
  try {
    const account = await getAccountByEmail(email);

    if (!account) {
      return null;
    }

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
      // twoFactorEnabled: account.twoFactorEnabled, // Currently foreign accounts might not fetch this field
      twoFactorEnabled: false, // Defaulting to false until settings support it or fetched differently
    };
  } catch (error) {
    console.error("Error getting OTP status:", error);
    return null;
  }
}

