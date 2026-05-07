"use server";

import { db } from "@heiso-io/bee/lib/db";
import type { TPublicApiKey } from "@heiso-io/bee/lib/db/schema";
import { apiKeys } from "@heiso-io/bee/lib/db/schema";
import { generateApiKey, hashApiKey } from "@heiso-io/bee/lib/hash";
import { auth } from "@heiso-io/bee/modules/auth/auth.config";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Generate truncated key for display (e.g., sk_a1b2...f6e5)
function truncateKey(rawKey: string): string {
  if (rawKey.length <= 12) return rawKey;
  return `${rawKey.substring(0, 7)}...${rawKey.substring(rawKey.length - 4)}`;
}

type TApiKeyWithKeyPrefix = TPublicApiKey & { keyPrefix: string };

const SELECT_PUBLIC = {
  id: apiKeys.id,
  name: apiKeys.name,
  truncatedKey: apiKeys.truncatedKey,
  roleId: apiKeys.roleId,
  createdByMemberId: apiKeys.createdByMemberId,
  rateLimitRequests: apiKeys.rateLimitRequests,
  rateLimitWindowSeconds: apiKeys.rateLimitWindowSeconds,
  lastUsedAt: apiKeys.lastUsedAt,
  expiresAt: apiKeys.expiresAt,
  createdAt: apiKeys.createdAt,
  updatedAt: apiKeys.updatedAt,
} as const;

// Get API Keys list — org-level resource, all logged-in members can list
export async function getApiKeysList(
  options: { search?: string; start?: number; limit?: number } = {},
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { apiKeys: [], total: 0 };
  }

  const { start = 0, limit = 10 } = options;

  try {
    const whereConditions = [isNull(apiKeys.deletedAt)];

    const [totalResult] = await db
      .select({ count: count() })
      .from(apiKeys)
      .where(and(...whereConditions));

    const results = await db
      .select(SELECT_PUBLIC)
      .from(apiKeys)
      .where(and(...whereConditions))
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(start);

    const transformedResults: TApiKeyWithKeyPrefix[] = results.map((r) => ({
      ...r,
      keyPrefix: r.truncatedKey || "???",
    }));

    return {
      apiKeys: transformedResults,
      total: totalResult.count,
    };
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return { apiKeys: [], total: 0 };
  }
}

export async function getApiKey(
  id: string,
): Promise<TApiKeyWithKeyPrefix | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const result = await db
      .select(SELECT_PUBLIC)
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), isNull(apiKeys.deletedAt)))
      .limit(1);

    if (result.length === 0) return null;

    const apiKey = result[0];
    return {
      ...apiKey,
      keyPrefix: apiKey.truncatedKey || "???",
    };
  } catch (error) {
    console.error("Error fetching API key:", error);
    return null;
  }
}

type RateLimit = { requests: number; window: number };

type CreateApiKeyInput = {
  name: string;
  roleId: string;
  expiresAt: Date | null;
  rateLimit?: RateLimit;
};

type UpdateApiKeyInput = {
  name?: string;
  roleId?: string;
  expiresAt?: Date | null;
  rateLimit?: RateLimit;
};

export async function createApiKey(data: CreateApiKeyInput): Promise<{
  success: boolean;
  apiKey?: TApiKeyWithKeyPrefix & { key: string };
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const newKey = generateApiKey();
    const hashedKey = await hashApiKey(newKey);
    const keyPrefix = truncateKey(newKey);

    const [result] = await db
      .insert(apiKeys)
      .values({
        name: data.name,
        key: hashedKey,
        truncatedKey: keyPrefix,
        roleId: data.roleId,
        createdByMemberId: session.user.id,
        rateLimitRequests: data.rateLimit?.requests ?? 100,
        rateLimitWindowSeconds: data.rateLimit?.window ?? 60,
        expiresAt: data.expiresAt,
      })
      .returning(SELECT_PUBLIC);

    revalidatePath("/portal/dev-center/api-keys", "page");

    return {
      success: true,
      apiKey: {
        ...result,
        keyPrefix: result.truncatedKey || keyPrefix,
        key: newKey,
      },
    };
  } catch (error) {
    console.error("Error creating API key:", error);
    return { success: false, error: "Failed to create API key" };
  }
}

export async function updateApiKey(
  id: string,
  data: UpdateApiKeyInput,
): Promise<{ success: boolean; data?: TApiKeyWithKeyPrefix; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await db
      .update(apiKeys)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.roleId !== undefined && { roleId: data.roleId }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
        ...(data.rateLimit && {
          rateLimitRequests: data.rateLimit.requests,
          rateLimitWindowSeconds: data.rateLimit.window,
        }),
        updatedAt: new Date(),
      })
      .where(and(eq(apiKeys.id, id), isNull(apiKeys.deletedAt)))
      .returning(SELECT_PUBLIC);

    if (result.length === 0) {
      return { success: false, error: "API key not found" };
    }

    const updatedApiKey: TApiKeyWithKeyPrefix = {
      ...result[0],
      keyPrefix: result[0].truncatedKey || "???",
    };

    revalidatePath("/portal/dev-center/api-keys", "page");
    return { success: true, data: updatedApiKey };
  } catch (error) {
    console.error("Error updating API key:", error);
    return { success: false, error: "Failed to update API key" };
  }
}

export async function deleteApiKey(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await db
      .update(apiKeys)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(apiKeys.id, id), isNull(apiKeys.deletedAt)))
      .returning({ id: apiKeys.id });

    if (result.length === 0) {
      return { success: false, error: "API key not found" };
    }

    revalidatePath("/portal/dev-center/api-keys", "page");
    return { success: true };
  } catch (error) {
    console.error("Error deleting API key:", error);
    return { success: false, error: "Failed to delete API key" };
  }
}

// Verify API key (for authentication middleware)
export async function verifyApiKey(key: string): Promise<{
  valid: boolean;
  apiKeyId?: string;
  roleId?: string;
}> {
  if (!key) return { valid: false };

  try {
    const hashedKey = await hashApiKey(key);

    const result = await db
      .select({
        id: apiKeys.id,
        roleId: apiKeys.roleId,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.key, hashedKey), isNull(apiKeys.deletedAt)))
      .limit(1);

    if (result.length === 0) return { valid: false };

    const apiKey = result[0];

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { valid: false };
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));

    return {
      valid: true,
      apiKeyId: apiKey.id,
      roleId: apiKey.roleId,
    };
  } catch (error) {
    console.error("Error verifying API key:", error);
    return { valid: false };
  }
}
