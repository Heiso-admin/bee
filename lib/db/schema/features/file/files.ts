import { generateId } from "@heiso-io/bee/lib/id-generator";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
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
import { members } from "../../auth/members";
import { fileFolders } from "./folders";
import { fileTagMapping } from "./tags";

export const files = pgTable(
  "files",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$defaultFn(() => generateId()),

    // 既有欄位
    name: varchar("name", { length: 255 }).notNull(),
    size: integer("size").notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    extension: varchar("extension", { length: 20 }).notNull(),
    url: varchar("url", { length: 255 }),
    path: varchar("path", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    metadata: jsonb("metadata"),
    folderId: varchar("folder_id", { length: 20 }).references(() => fileFolders.id),
    ownerId: varchar("owner_id", { length: 50 }).notNull(),

    // 新增(assets-foundation Phase B)
    // 不存 tenantId — DB name 已綁 tenant identity,row 內存重複多餘
    // S3 path 的 {tenant}/ 前綴從 process.env.TENANT_ID 拿,不從 row
    hash: varchar("hash", { length: 64 }),
    scanStatus: varchar("scan_status", { length: 20 }).notNull().default("clean"),
    gpsLat: numeric("gps_lat", { precision: 9, scale: 6 }),
    gpsLng: numeric("gps_lng", { precision: 9, scale: 6 }),
    capturedAt: timestamp("captured_at"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("files_name_idx").on(table.name),
    index("files_type_idx").on(table.type),
    index("files_owner_id_idx").on(table.ownerId),
    index("files_folder_id_idx").on(table.folderId),
    // dedup:cell DB 單 tenant,只需要 hash 就夠唯一
    index("files_dedup_idx").on(table.hash),
  ],
);

export const filesRelations = relations(files, ({ one, many }) => ({
  folder: one(fileFolders, {
    fields: [files.folderId],
    references: [fileFolders.id],
  }),
  owner: one(members, {
    fields: [files.ownerId],
    references: [members.id],
  }),
  tagMappings: many(fileTagMapping),
}));

export const filesSchema = createSelectSchema(files);
export const filesInsertSchema = createInsertSchema(files);
export const filesUpdateSchema = createUpdateSchema(files);

export type File = zod.infer<typeof filesSchema>;
export type FileInsert = zod.infer<typeof filesInsertSchema>;
export type FileUpdate = zod.infer<typeof filesUpdateSchema>;
