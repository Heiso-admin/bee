import { generatePermissionId } from "@heiso-io/bee/lib/id-generator";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import type zod from "zod";

export const apiPermissions = pgTable(
  "api_permissions",
  {
    id: varchar("id", { length: 20 })
      .primaryKey()
      .$default(() => generatePermissionId()),
    resource: varchar("resource", { length: 100 }).notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("api_permissions_resource_action_idx").on(
      table.resource,
      table.action,
    ),
    index("api_permissions_deleted_at_idx").on(table.deletedAt),
  ],
);

export const apiPermissionsSchema = createSelectSchema(apiPermissions);
export const apiPermissionsInsertSchema = createInsertSchema(apiPermissions);
export const apiPermissionsUpdateSchema = createUpdateSchema(apiPermissions);

export type TApiPermission = zod.infer<typeof apiPermissionsSchema>;
export type TApiPermissionInsert = zod.infer<typeof apiPermissionsInsertSchema>;
export type TApiPermissionUpdate = zod.infer<typeof apiPermissionsUpdateSchema>;
