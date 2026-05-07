"use server";

import { ALLOWED_DEV_EMAILS } from "../auth.config";

/**
 * Server-side check: is this email a dev?
 * Used by /login to detect dev email and route to OTP-only flow.
 */
export async function isDevEmail(email: string): Promise<boolean> {
  return ALLOWED_DEV_EMAILS.includes(email.trim().toLowerCase());
}
