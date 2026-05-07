import { generateId } from "@heiso-io/bee/lib/id-generator";
import { type AnyPgColumn, foreignKey, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type zod from "zod";

export const menus = pgTable(
  "menus",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$defaultFn(() => generateId()),
    title: varchar("title", { length: 100 }).notNull(),
    path: varchar("path", { length: 255 }),
    icon: varchar("icon", { length: 50 }),
    parentId: varchar("parent_id", { length: 20 }),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "menus_parent_id_fk",
    }).onDelete("set null"),
    index("menus_parent_id_idx").on(table.parentId),
    index("menus_sort_order_idx").on(table.sortOrder),
    index("menus_deleted_at_idx").on(table.deletedAt),
  ],
);

export const menusSchema = createSelectSchema(menus);
export const menusInsertSchema = createInsertSchema(menus);
export const menusUpdateSchema = createUpdateSchema(menus);

export type TMenu = zod.infer<typeof menusSchema>;
export type TMenuInsert = zod.infer<typeof menusInsertSchema>;
export type TMenuUpdate = zod.infer<typeof menusUpdateSchema>;
