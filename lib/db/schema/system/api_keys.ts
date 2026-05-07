import { generateId } from "@heiso-io/bee/lib/id-generator";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { members } from "../auth/members";
import { roles } from "../permissions/role";

/**
 * API Keys — org-level resources（不綁特定 user）。
 * - role_id: 該 key 能做什麼（permissions 從 role 繼承）
 * - created_by_member_id: 是哪個 admin 開的（audit；admin 離職 SET NULL，key 不死）
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$defaultFn(() => generateId()),
    name: varchar("name", { length: 100 }).notNull(),
    key: varchar("key", { length: 255 }).notNull().unique(),
    truncatedKey: varchar("truncated_key", { length: 30 }).notNull(),
    roleId: varchar("role_id", { length: 20 })
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    createdByMemberId: varchar("created_by_member_id", { length: 50 })
      .references(() => members.id, { onDelete: "set null" }),
    rateLimitRequests: integer("rate_limit_requests").notNull().default(100),
    rateLimitWindowSeconds: integer("rate_limit_window_seconds")
      .notNull()
      .default(60),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("api_keys_role_id_idx").on(table.roleId),
    index("api_keys_created_by_idx").on(table.createdByMemberId),
    index("api_keys_key_idx").on(table.key),
    index("api_keys_deleted_at_idx").on(table.deletedAt),
  ],
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  role: one(roles, {
    fields: [apiKeys.roleId],
    references: [roles.id],
  }),
  createdBy: one(members, {
    fields: [apiKeys.createdByMemberId],
    references: [members.id],
  }),
}));

export type TApiKey = typeof apiKeys.$inferSelect;
export type TInsertApiKey = typeof apiKeys.$inferInsert;

export type TCreateApiKey = Omit<
  TInsertApiKey,
  "id" | "key" | "truncatedKey" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type TUpdateApiKey = Partial<
  Pick<TApiKey, "name" | "expiresAt" | "roleId">
>;

export type TPublicApiKey = Omit<TApiKey, "key" | "deletedAt">;
