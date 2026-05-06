"use server";

/**
 * Thin wrappers preserving the old sendDevOTP / verifyDevOTP names.
 * The single source of truth is now `generateOTP` / `verifyOTP` with `mode: "dev"`.
 */

import { generateOTP, verifyOTP } from "@heiso-io/bee/modules/auth/_server/otp.service";

export async function sendDevOTP(email: string) {
  const result = await generateOTP(email, { mode: "dev" });
  return result.success
    ? { success: true, expiresAt: result.expiresAt }
    : { success: false, error: result.message };
}

export async function verifyDevOTP(email: string, code: string) {
  const result = await verifyOTP(email, code, { mode: "dev" });
  return result.success
    ? { success: true, accountId: result.accountId }
    : { success: false, error: result.message };
}
