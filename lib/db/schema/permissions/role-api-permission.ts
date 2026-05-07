import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core";
import { apiPermissions } from "./api-permission";
import { roles } from "./role";

export const roleApiPermissions = pgTable(
  "role_api_permissions",
  {
    roleId: varchar("role_id", { length: 20 })
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    apiPermissionId: varchar("api_permission_id", { length: 20 })
      .references(() => apiPermissions.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.apiPermissionId] }),
    index("role_api_permissions_permission_id_idx").on(table.apiPermissionId),
  ],
);

export const roleApiPermissionsRelations = relations(
  roleApiPermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [roleApiPermissions.roleId],
      references: [roles.id],
    }),
    apiPermission: one(apiPermissions, {
      fields: [roleApiPermissions.apiPermissionId],
      references: [apiPermissions.id],
    }),
  }),
);
