import { generateRoleId } from "@heiso-io/bee/lib/id-generator";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  json,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type zod from "zod";
import { members } from "../auth/members";
import { roleMenus } from "./role-menus";
import { roleApiPermissions } from "./role-api-permission";

export const roles = pgTable(
  "roles",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$default(() => generateRoleId()),
    name: varchar("name", { length: 50 }).notNull().unique(),
    description: varchar("description", { length: 255 }),
    sortOrder: integer("sort_order").default(0),

    /**
     * Per-role allowed login methods. Member 該 role 的 user 在 /auth/login 只看得到這幾種選項。
     * 至少 1 個必須 true（DB CHECK enforce），不能全 false。
     */
    allowMagicLink: boolean("allow_magic_link").notNull().default(true),
    allowPassword: boolean("allow_password").notNull().default(true),
    allowTwoFactor: boolean("allow_two_factor").notNull().default(false),

    /**
     * Allowed module IDs (e.g. ["cms", "editor", "account"]).
     * Sidebar / menu / API gating filters by this — empty array = no module access.
     * Module IDs are code-side stable strings (see MODULES const).
     */
    allowedModules: json("allowed_modules")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::json`),

    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("roles_name_idx").on(table.name),
    index("roles_deleted_at_idx").on(table.deletedAt),
    check(
      "roles_at_least_one_login_method_check",
      sql`${table.allowMagicLink} OR ${table.allowPassword} OR ${table.allowTwoFactor}`,
    ),
  ],
);

export const roleRelations = relations(roles, ({ many }) => ({
  menus: many(roleMenus),
  apiPermissions: many(roleApiPermissions),
  members: many(members),
}));

export const rolesSchema = createSelectSchema(roles);
export const rolesInsertSchema = createInsertSchema(roles);
export const rolesUpdateSchema = createUpdateSchema(roles);

export type TRole = zod.infer<typeof rolesSchema>;
export type TRoleInsert = zod.infer<typeof rolesInsertSchema>;
export type TRoleUpdate = zod.infer<typeof rolesUpdateSchema>;
