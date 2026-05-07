import {
  boolean,
  check,
  index,
  json,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type zod from "zod";

/**
 * settings 表
 *
 * 存放 runtime 可改的設定（admin UI 編輯，不要重 deploy），用 group 區分：
 * - 'system': 後端基礎設定（NOTIFY_EMAIL、BASE_HOST、OAuth credentials 等）
 * - 'site': 前端展示設定（org name、logo、branding、SEO meta 等）
 *
 * 不放這裡：
 * - tenantId / DATABASE_URL / ERROR_CODE_SECRET 等 deploy-time 不可變的 → env
 * - 業務資料（members、posts、roles）→ domain table
 */
export const settings = pgTable(
  "settings",
  {
    // 主鍵
    name: varchar("name", { length: 100 }).notNull().primaryKey(),

    // 值
    value: json("value").notNull(),

    // 分組與元資料
    group: varchar("group", { length: 50 }).notNull().default("system"),
    description: varchar("description", { length: 255 }),
    isKey: boolean("is_key").notNull().default(false),

    // Timestamps
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("settings_group_idx").on(table.group),
    index("settings_is_key_idx").on(table.isKey),
    index("settings_deleted_at_idx").on(table.deletedAt),
    check("settings_group_check", sql`${table.group} IN ('system', 'site')`),
  ],
);

export const settingsSchema = createSelectSchema(settings);
export const settingsInsertSchema = createInsertSchema(settings);
export const settingsUpdateSchema = createUpdateSchema(settings);

export type TSettings = zod.infer<typeof settingsSchema>;
export type TSettingsInsert = zod.infer<typeof settingsInsertSchema>;
export type TSettingsUpdate = zod.infer<typeof settingsUpdateSchema>;
