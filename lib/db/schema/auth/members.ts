import { generateAccountId } from "@heiso-io/bee/lib/id-generator";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type zod from "zod";
import { roles } from "../permissions/role";
import { type Role, type MemberStatus } from "@heiso-io/bee/types/member";

/**
 * members - 內部成員身份（後台使用者）
 *
 * 每個 tenant DB 獨立。初始 owner 由 Hive 寫入。
 * 外部使用者（user-facing 產品）走獨立 codebase / schema，不在 bee 範圍。
 */
export const members = pgTable(
  "members",
  {
    id: varchar("id", { length: 50 })
      .primaryKey()
      .$default(() => generateAccountId()),

    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    avatar: varchar("avatar", { length: 255 }),

    active: boolean("active").notNull().default(true),

    lastLoginAt: timestamp("last_login_at"),
    loginMethod: varchar("login_method", { length: 20 }).default("email"),

    /**
     * 2FA via email OTP — login 時若 true，password 驗完還要再寄一次性 code 到信箱驗。
     * Magic-link 路徑自動 bypass（信箱本身就是 factor）。
     */
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),

    mustChangePassword: boolean("must_change_password").notNull().default(false),

    role: varchar("role", { length: 20 })
      .notNull()
      .default("member")
      .$type<Role>(),

    roleId: varchar("role_id", { length: 20 }).references(() => roles.id),

    status: varchar("status", { length: 20 })
      .notNull()
      .default("invited")
      .$type<MemberStatus>(),

    inviteToken: varchar("invite_token", { length: 50 }),
    inviteExpiredAt: timestamp("invite_expired_at"),
    invitedBy: varchar("invited_by", { length: 50 }),

    joinedAt: timestamp("joined_at"),

    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("members_email_idx").on(table.email),
    index("members_role_idx").on(table.role),
    index("members_status_idx").on(table.status),
    index("members_invite_token_idx").on(table.inviteToken),
    index("members_last_login_idx").on(table.lastLoginAt),
    index("members_deleted_at_idx").on(table.deletedAt),
    check("members_role_check", sql`${table.role} IN ('owner', 'member')`),
    check(
      "members_status_check",
      sql`${table.status} IN ('invited', 'active', 'inactive', 'suspended')`,
    ),
    check(
      "members_login_method_check",
      sql`${table.loginMethod} IN ('both', 'otp', 'email', 'sso')`,
    ),
    // 每個 tenant DB 只能有一個 active owner
    uniqueIndex("members_single_owner_idx")
      .on(table.role)
      .where(sql`${table.role} = 'owner' AND ${table.deletedAt} IS NULL`),
  ],
);

export const membersRelations = relations(members, ({ one }) => ({
  customRole: one(roles, {
    fields: [members.roleId],
    references: [roles.id],
  }),
}));

export const membersSchema = createSelectSchema(members);
export const membersInsertSchema = createInsertSchema(members);
export const membersUpdateSchema = createUpdateSchema(members);

export type TMember = zod.infer<typeof membersSchema>;
export type TMemberInsert = zod.infer<typeof membersInsertSchema>;
export type TMemberUpdate = zod.infer<typeof membersUpdateSchema>;
