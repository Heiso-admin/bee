"use server";

import { decodeMagicToken, type MagicTokenPayload } from "@heiso-io/bee/lib/magic-token";

/**
 * Server-only wrapper — decode magic-link token in client component flow.
 * Returns null if token invalid / expired / tampered.
 */
export async function resolveMagicToken(
  token: string,
): Promise<MagicTokenPayload | null> {
  return decodeMagicToken(token);
}
