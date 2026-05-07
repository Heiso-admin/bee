"use server";

import { db } from "@heiso-io/bee/lib/db";
import { roleMenus, roleApiPermissions } from "@heiso-io/bee/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function assignMenus({
  roleId,
  menus,
}: {
  roleId: string;
  menus: string[];
}) {
  await db.transaction(async (tx) => {
    await tx.delete(roleMenus).where(eq(roleMenus.roleId, roleId));
    if (menus.length > 0) {
      await tx.insert(roleMenus).values(
        menus.map((menuId) => ({
          roleId,
          menuId,
        })),
      );
    }
  });
  revalidatePath("/portal/account/role", "page");
}

async function assignPermissions({
  roleId,
  permissions,
}: {
  roleId: string;
  permissions: string[];
}) {
  await db.transaction(async (tx) => {
    await tx.delete(roleApiPermissions).where(eq(roleApiPermissions.roleId, roleId));
    if (permissions.length > 0) {
      await tx.insert(roleApiPermissions).values(
        permissions.map((apiPermissionId) => ({
          roleId,
          apiPermissionId,
        })),
      );
    }
  });
  revalidatePath("/portal/account/role", "page");
}

export { assignMenus, assignPermissions };
